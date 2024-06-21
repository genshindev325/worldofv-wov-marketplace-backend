import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard, GqlAuthGuard, GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  AuctionServiceClient,
  AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/auction';
import {
  MarketplaceServiceClient,
  MARKETPLACE_SERVICE_NAME,
} from '@generated/ts-proto/services/marketplace';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { User as RpcUser } from '@generated/ts-proto/types/user';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import {
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  OnModuleInit,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { AuctionStatus, Prisma as PrismaAuction } from '@prisma/client/auction';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { ReSyncResult } from 'apps/gateway/src/common/resync-result.response';
import { GetEditionsResponse } from 'apps/gateway/src/tokens/get-editions.response';
import { User } from 'apps/gateway/src/user/user.response';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { parse as createCsvParser } from 'csv-parse';
import { FileUpload, GraphQLUpload } from 'graphql-upload';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { AggregatedToken } from './aggregated-token.response';
import { FindOneTokenArgs } from './find-one-token.args';
import { GetAuctionArgs } from './get-auction.args';
import { GetAuctionResponse } from './get-auction.response';
import { GetGenerationRateArgs } from './get-generation-rate.args';
import { GetGenesisCountBySetArgs } from './get-genesis-count-by-set.args';
import { GenesisCount } from './get-genesis-count.response';
import { GetMissingTokensArgs } from './get-missing-tokens-for-set.args';
import { GetMissingTokensResponse } from './get-missing-tokens-for-set.response';
import { GetOwnedCountByCollectionArgs } from './get-owned-count-by-collection.args';
import { GetStakedTokensArgs } from './get-staked-tokens.args';
import { GetStakedTokensResponse } from './get-staked-tokens.response';
import { GetTokensArgs } from './get-tokens.args';
import { GetTokensResponse } from './get-tokens.response';
import { TokenExistsArgs } from './token-exists.args';
import { TokenDTO } from './token.response';
import { UpdateFreeShippingArgs } from './update-free-shipping.args';

@Resolver(() => TokenDTO)
export class TokensResolver implements OnModuleInit {
  private readonly logger = new Logger(TokensResolver.name);

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_SYNC_CACHE_TTL) || 0;

  private grpcUser: UserServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;
  private grpcAuction: AuctionServiceClient;
  private grpcMarketplace: MarketplaceServiceClient;
  private grpcThumbnail: ImageThumbnailServiceClient;
  private grpcSale: SaleServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.AUCTION)
    private readonly auctionClient: ClientGrpc,

    @Inject(GrpcClientKind.MARKETPLACE)
    private readonly marketplaceClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly thumbnailClient: ClientGrpc,

    @Inject(GrpcClientKind.SALE)
    private readonly saleClient: ClientGrpc,

    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceRedisClient: ClientProxy,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);

    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);

    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);

    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);

    this.grpcMarketplace = this.marketplaceClient.getService(
      MARKETPLACE_SERVICE_NAME,
    );

    this.grpcThumbnail = this.thumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );

    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
  }

  @Query(() => Boolean)
  @CacheControl(TokensResolver.CACHE_TTL)
  async getTokenExists(@Args() args: TokenExistsArgs) {
    return await lastValueFrom(
      this.grpcToken.exists(args).pipe(map(({ value }) => value)),
    );
  }

  @Query(() => AggregatedToken, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getToken(@Args() args: FindOneTokenArgs) {
    return await lastValueFrom(this.grpcMarketplace.getToken(args));
  }

  @Query(() => GetEditionsResponse, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getTokenEditions(@Args() args: FindOneTokenArgs) {
    return await this.grpcMarketplace.getEditions(args);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => GetTokensResponse, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async tokens(@Args() args: GetTokensArgs, @CurrentUser() user?: RpcUser) {
    const metadata = new Metadata();
    metadata.add('user_address', user?.address);
    metadata.add('is_admin', user?.isAdmin?.toString());

    const attributes = args?.filters?.attributes
      ? JSON.stringify(args.filters.attributes)
      : null;

    const filters = { ...(args?.filters || {}), attributes };
    const getTokensArgs = { ...(args || {}), filters };

    return await this.grpcMarketplace.getTokens(getTokensArgs, metadata).pipe(
      map(({ items, ...val }) => {
        return {
          ...val,
          items: (items || []).map((el) => ({
            ...el,
            minimumAuctionEndTime: el.minimumAuctionEndTime
              ? new Date(el.minimumAuctionEndTime)
              : null,
          })),
        };
      }),
    );
  }

  @UseGuards(GqlUserGuard)
  @Query(() => GetStakedTokensResponse, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getStakedTokens(
    @Args() args: GetStakedTokensArgs,
    @CurrentUser() user: RpcUser,
  ) {
    return await lastValueFrom(
      this.grpcEdition
        .findMany(
          encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
            where: {
              ownerAddress: user.address,
              token: { collectionId: args.collectionId },
              ...(args.stakingContractAddress
                ? { stakingContractAddress: args.stakingContractAddress }
                : { NOT: { stakingContractAddress: null } }),
            },
          }),
        )
        .pipe(
          map((res) => {
            const items = res.editions.map((edition) =>
              _.pick(edition, [
                'tokenId',
                'editionId',
                'smartContractAddress',
                'stakingContractAddress',
              ]),
            );

            return { items };
          }),
          catchError((err) => {
            this.logger.error(
              `${this.getStakedTokens.name}] Error while fetching staked tokens via gRPC to "NFT->EditionService"`,
              err,
            );

            return { items: [] } as any;
          }),
        ),
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlUserGuard)
  async updateFreeShipping(
    @Args() args: UpdateFreeShippingArgs,
    @CurrentUser() user: RpcUser,
  ) {
    const { editionId, smartContractAddress, isFreeShipping } = args;
    const edition = await lastValueFrom(
      this.grpcEdition.findOne(
        encodeSerializedJson<PrismaNft.EditionFindUniqueArgs>({
          where: {
            editionId_smartContractAddress: {
              editionId,
              smartContractAddress,
            },
          },
        }),
      ),
    );

    if (!isSameAddress(edition.ownerAddress, user.address))
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const updatedEdition = await lastValueFrom(
      this.grpcEdition.update(
        encodeSerializedJson<PrismaNft.EditionUpdateArgs>({
          where: {
            editionId_smartContractAddress: {
              editionId,
              smartContractAddress,
            },
          },
          data: { isFreeShipping },
        }),
      ),
    );
    return updatedEdition.isFreeShipping;
  }

  @Query(() => GetAuctionResponse, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getAuction(@Args() args: GetAuctionArgs): Promise<GetAuctionResponse> {
    return await lastValueFrom(
      this.grpcAuction
        .findUnique(
          encodeSerializedJson<PrismaAuction.AuctionFindUniqueArgs>({
            where: { auctionId: args.auctionId },
          }),
        )
        .pipe(
          map(async (auction) => {
            const [seller, token] = await Promise.all([
              args.includeSeller
                ? lastValueFrom(
                    this.grpcUser
                      .findUnique(
                        encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
                          where: { address: auction.sellerAddress },
                        }),
                      )
                      .pipe(
                        catchError((error) => {
                          if (error?.code === GrpcStatus.NOT_FOUND) {
                            return of({
                              address: auction.sellerAddress,
                            } as User);
                          } else {
                            return throwError(() => error);
                          }
                        }),
                      ),
                  )
                : null,

              args.includeToken
                ? this.getToken({
                    tokenId: auction.tokenId,
                    smartContractAddress: auction.smartContractAddress,
                  })
                : null,
            ]);

            const startingTime = auction.startingTime
              ? new Date(auction.startingTime)
              : null;

            const endTime = auction.endTime ? new Date(auction.endTime) : null;

            return {
              ...auction,
              status: auction.status as AuctionStatus,
              seller: seller as User,
              token: token as AggregatedToken,
              endTime: endTime,
              startingTime: startingTime,
              reservePrice: auction.reservePrice.toString(),
            };
          }),
        ),
    );
  }

  @Query(() => String, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getGenerationRateForUser(@Args() args: GetGenerationRateArgs) {
    return await lastValueFrom(
      this.grpcToken
        .getGenerationRate(args)
        .pipe(map(({ stakingEarnings }) => of(stakingEarnings))),
    );
  }

  @Query(() => [GenesisCount], { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getGenesisCountBySet(@Args() args: GetGenesisCountBySetArgs) {
    return lastValueFrom(
      this.grpcToken
        .getGenesisCountBySet(args)
        .pipe(map(({ counts }) => of(counts))),
    );
  }

  @Query(() => Number, { nullable: true })
  @CacheControl(TokensResolver.CACHE_TTL)
  async getOwnedCountByCollection(@Args() args: GetOwnedCountByCollectionArgs) {
    return lastValueFrom(
      this.grpcEdition
        .count(
          encodeSerializedJson<PrismaNft.EditionCountArgs>({
            where: {
              ownerAddress: args.ownerAddress,
              smartContractAddress: args.smartContractAddress,
            },
          }),
        )
        .pipe(map(({ value }) => of(value))),
    );
  }

  @Query(() => GetMissingTokensResponse, { nullable: true })
  async getMissingTokens(@Args() args: GetMissingTokensArgs) {
    return lastValueFrom(this.grpcMarketplace.getMissingTokens(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => ReSyncResult)
  async overrideCollectionMetadata(
    @Args('smartContractAddress') smartContractAddress: string,
    @Args({ name: 'metadata', type: () => GraphQLUpload }) upload: FileUpload,
  ) {
    const parser = createCsvParser({
      columns: true,
      trim: true,
      skipEmptyLines: true,
    });

    upload.createReadStream().pipe(parser);

    const metadata: any[] = await new Promise((resolve, reject) => {
      const result: Record<string, any>[] = [];

      parser.on('data', (data) => {
        const tokenId = data.tokenId;
        const rank = data.rank ? parseInt(data.rank) : null;
        const score = data.score ? parseFloat(data.score) : null;

        if (!tokenId || isNaN(rank) || isNaN(score)) {
          reject(
            new HttpException('Invalid CSV.', HttpStatus.UNPROCESSABLE_ENTITY),
          );
        }

        result.push({ tokenId, rank, score });
      });

      parser.on('error', (error) => reject(error));
      parser.on('end', () => resolve(result));
    });

    await lastValueFrom(
      this.grpcToken.overrideMetadata({ smartContractAddress, metadata }),
    );

    return { done: true };
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => ReSyncResult)
  async setGenesisClaimedStatus(
    @Args('ownerAddress') ownerAddress: string,
    @Args('setName') setName: string,
    @Args('claimedStatus') claimedStatus: boolean,
  ) {
    const { tokens } = await lastValueFrom(
      this.grpcToken.findMany(
        encodeSerializedJson<PrismaNft.TokenFindManyArgs>({
          select: {
            tokenId: true,
            attributes: true,
          },
          where: {
            smartContractAddress: process.env.WOW_GENESIS_CONTRACT_ADDRESS,
            editions: { some: { ownerAddress } },
          },
        }),
      ),
    );

    const [currentStatus, wantedStatus] = claimedStatus
      ? ['Unclaimed', 'Claimed']
      : ['Claimed', 'Unclaimed'];

    const tokensForSet = tokens.filter((t) =>
      t.attributes.find(
        (a) => a.trait_type === setName && a.value === currentStatus,
      ),
    );

    const uniqueTokensByCountry = _.uniqBy(
      tokensForSet,
      (t) => t.attributes.find((a) => a.trait_type === 'Country').value,
    );

    for (const { tokenId, attributes } of uniqueTokensByCountry) {
      const attribute = attributes.find((a) => a.trait_type === setName);
      attribute.value = wantedStatus;

      await lastValueFrom(
        this.grpcToken.update(
          encodeSerializedJson<PrismaNft.TokenUpdateArgs>({
            where: {
              tokenId_smartContractAddress: {
                smartContractAddress: process.env.WOW_GENESIS_CONTRACT_ADDRESS,
                tokenId,
              },
            },
            data: {
              attributes: attributes as any,
            },
          }),
        ),
      );
    }

    return { done: true };
  }
}
