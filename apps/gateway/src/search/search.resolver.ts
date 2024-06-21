import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Asset, AssetSize } from '@generated/ts-proto/types/asset';
import { hasFields } from '@jenyus-org/graphql-utils';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Args, Info, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, map } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { SearchByStringResponse } from './search-by-string-response';
import { SearchByStringArgs } from './search-by-string.args';
import { SearchCollectionsByStringResponse } from './search-collections-by-string.response';

@Resolver()
export class SearchResolver implements OnModuleInit {
  private readonly logger = new Logger(SearchResolver.name);

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_SLOW_CACHE_TTL) || 0;

  private grpcUser: UserServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  /**
   * @returns Map [smart contract address]_[token id] -> [asset]
   */
  async fetchAssets(
    tokenIds: { smartContractAddress: string; tokenId: string }[],
  ) {
    const assetsById = new Map<string, Asset>();

    const items = await lastValueFrom(
      this.grpcImageThumbnail
        .getManyTokenAssets({
          identifiers: tokenIds,
          filters: { sizes: [AssetSize.STATIC_COVER_128] },
        })
        .pipe(map(({ items }) => items || {})),
    );

    for (const [key, { assets }] of Object.entries(items)) {
      assetsById.set(key, assets[0]);
    }

    return assetsById;
  }

  @Query(() => SearchByStringResponse)
  @CacheControl(SearchResolver.CACHE_TTL)
  async searchByString(@Args() args: SearchByStringArgs, @Info() info: any) {
    let { tokens } = hasFields(info, 'searchByString.tokens')
      ? await lastValueFrom(this.grpcToken.searchTokensByString(args))
      : { tokens: null };
    if (tokens) {
      const tokenIds = tokens.map((token) => ({
        tokenId: token.tokenId,
        smartContractAddress: token.smartContractAddress,
      }));

      const assetsById = await this.fetchAssets(tokenIds);

      tokens = tokens.map((token) => {
        const key = `${token.smartContractAddress}_${token.tokenId}`;
        const asset = assetsById.get(key) || {
          url: token.imageUrl,
          mimeType: token.imageMimeType,
        };
        return { ...token, asset };
      });
    }

    const { collections } = hasFields(info, 'searchByString.collections')
      ? await lastValueFrom(this.grpcCollection.searchCollectionsByString(args))
      : { collections: null };

    const { users } = hasFields(info, 'searchByString.users')
      ? await lastValueFrom(this.grpcUser.searchUsersByString(args))
      : { users: null };

    return { tokens, collections, users };
  }

  @Query(() => SearchCollectionsByStringResponse)
  @CacheControl(SearchResolver.CACHE_TTL)
  async searchCollectionsByString(@Args() args: SearchByStringArgs) {
    const { collections } = await lastValueFrom(
      this.grpcCollection.searchCollectionsByString({ ...args, limit: 24 }),
    );
    return { collections };
  }
}
