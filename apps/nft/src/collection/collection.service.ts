import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  GetWoVCollectionsArgs,
  SearchCollectionsByStringArgs,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  OfferServiceClient,
  OFFER_SERVICE_NAME,
} from '@generated/ts-proto/services/offer';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Collection } from '@generated/ts-proto/types/collection';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  Collection as PrismaCollection,
  Prisma as PrismaNft,
  PrismaClient,
} from '@prisma/client/nft';
import { OfferStatus, Prisma as PrismaOffer } from '@prisma/client/offer';
import { Prisma as PrismaSale, SaleStatus } from '@prisma/client/sale';
import { Queue } from 'bullmq';
import { encodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, map, of } from 'rxjs';

@Injectable()
export class CollectionService implements OnModuleInit {
  private readonly logger = new Logger(CollectionService.name);

  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;
  private grpcSale: SaleServiceClient;
  private grpcOffer: OfferServiceClient;
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.SALE)
    private readonly saleClient: ClientGrpc,

    @Inject(GrpcClientKind.OFFER)
    private readonly offerClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    private readonly prisma: PrismaClient,

    @InjectQueue('nft/collection/resync')
    protected readonly collectionResyncQueue: Queue,
  ) {}

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);

    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);

    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
    this.grpcOffer = this.offerClient.getService(OFFER_SERVICE_NAME);

    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  prismaCollectionToGrpc(collection: PrismaCollection): Collection {
    // All properties are optional since the request from the client might
    // select only specific fields from the database.
    const { minimumOffer, importedAt, stakingEndDate, ...data } =
      collection || ({} as PrismaCollection);

    return {
      ...data,
      fetcherConfig: collection?.fetcherConfig as any,
      minimumOffer: minimumOffer?.toFixed(0),
      importedAt: importedAt?.toISOString(),
      stakingEndDate: stakingEndDate?.toISOString(),
      tokens: [],
    };
  }

  async findOne(
    where: PrismaNft.CollectionWhereUniqueInput,
  ): Promise<PrismaCollection | null> {
    return this.prisma.collection.findUnique({ where });
  }

  async getWoVCollections({ ownerAddress, brandId }: GetWoVCollectionsArgs) {
    const ownedCollectionIds = ownerAddress
      ? await lastValueFrom(
          this.grpcToken
            .findMany(
              encodeSerializedJson<PrismaNft.TokenFindManyArgs>({
                select: { collectionId: true },
                distinct: 'collectionId',
                where: { editions: { some: { ownerAddress } } },
              }),
            )
            .pipe(
              map(({ tokens }) => (tokens || []).map((e) => e.collectionId)),
            ),
        )
      : undefined;

    return this.prisma.collection.findMany({
      where: {
        collectionId: { in: ownedCollectionIds?.filter((id) => id) },
        OR: [{ type: 'EXTERNAL' }, { isWoVCollection: true }],
        brandId: brandId || null,
        isVisible: true,
      },
      orderBy: { importedAt: 'desc' },
    });
  }

  async upsert(
    where: PrismaNft.CollectionWhereUniqueInput,
    data: PrismaNft.CollectionCreateInput,
  ): Promise<PrismaCollection> {
    return this.prisma.collection.upsert({
      where,
      update: data,
      create: data,
    });
  }

  // TODO: Understand if the ignored attributes can be removed from query directly to save up space
  async getTokenAttributes(collection: Collection) {
    const attributes = await this.prisma.$queryRawUnsafe<any>(`
      WITH q AS (
        SELECT
          "attribute"->'trait_type' AS "key",
          "attribute"->'value' AS "value",
          COUNT("value")::INT
        FROM
          "Token"
          CROSS JOIN JSONB_ARRAY_ELEMENTS(attributes) AS "attribute"
        WHERE "Token"."collectionId" = '${collection.collectionId}'
        GROUP BY "attribute"."value"
      )
      SELECT
        q."key",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'value', q."value",
            'count', q."count"
          )
          ORDER BY count ASC
        ) "values"
      FROM q
      WHERE q."key" IS NOT NULL
      GROUP BY q."key"
    `);

    return attributes;
  }

  async searchCollectionsByString({
    text,
    limit,
    onlyStakable,
  }: SearchCollectionsByStringArgs) {
    const whereObj: { [key: string]: any } = {
      isVisible: true,
    };
    if (onlyStakable)
      whereObj['stakingContractAddresses'] = {
        isEmpty: false,
      };
    return await this.prisma.collection.findMany({
      select: {
        collectionId: true,
        smartContractAddress: true,
        stakingContractAddresses: true,
        name: true,
        customUrl: true,
        thumbnailImageUrl: true,
        isVerified: true,
      },
      where: {
        OR: [
          {
            name: {
              contains: text,
              mode: 'insensitive',
            },
          },
          {
            smartContractAddress: {
              equals: text,
            },
          },
        ],
        AND: {
          ...whereObj,
        },
      },
      orderBy: {
        isVerified: 'desc',
      },
      take: limit,
    });
  }

  async getStats(collection: Collection) {
    const [
      itemsCount,
      ownersCount,
      floorPrices,
      offersCount,
      highestCollectionOffer,
    ] = await Promise.all([
      // Items Count
      lastValueFrom(
        this.grpcToken
          .count(
            encodeSerializedJson<PrismaNft.TokenCountArgs>({
              where: {
                smartContractAddress: collection.smartContractAddress,
              },
            }),
          )
          .pipe(
            map((el) => el.value),
            catchError((err) => {
              this.logger.error(err);
              return of(null);
            }),
          ),
      ),

      // Unique Owners Count
      lastValueFrom(
        this.grpcEdition
          .findMany(
            encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
              select: { ownerAddress: true },
              where: {
                smartContractAddress: collection.smartContractAddress,
              },
              distinct: 'ownerAddress',
            }),
          )
          .pipe(
            map((el) => el.editions.length),
            catchError((err) => {
              this.logger.error(err);
              return of(null);
            }),
          ),
      ),

      // Floor prices
      lastValueFrom(
        this.grpcSale
          .findMany(
            encodeSerializedJson<PrismaSale.SaleFindManyArgs>({
              select: { price: true, addressVIP180: true },
              distinct: 'addressVIP180',
              where: {
                smartContractAddress: collection.smartContractAddress,
                status: SaleStatus.LISTED,
                startingTime: { lte: new Date() },
              },
              orderBy: { price: 'asc' },
            }),
          )
          .pipe(
            map(({ sales }) => sales),
            catchError((err) => {
              this.logger.error(err);
              return of(null);
            }),
          ),
      ),

      // Get the count of active offers
      lastValueFrom(
        this.grpcOffer
          .count(
            encodeSerializedJson<PrismaOffer.OfferCountArgs>({
              where: {
                smartContractAddress: collection.smartContractAddress,
                status: OfferStatus.ACTIVE,
                endTime: { gt: new Date() },
              },
            }),
          )
          .pipe(
            map((el) => el.value),
            catchError((err) => {
              this.logger.error(err);
              return of(null);
            }),
          ),
      ),

      //Highest Collection Offer
      lastValueFrom(
        this.grpcOffer
          .findHighest({
            smartContractAddress: collection.smartContractAddress,
          })
          .pipe(
            map(({ offer }) => offer),
            catchError((err) => {
              this.logger.error(err);
              return of(null);
            }),
          ),
      ),
    ]);

    return {
      itemsCount,
      ownersCount,
      floorPrices,
      offersCount,
      highestCollectionOffer,
    };
  }

  async getCreator(address: string) {
    try {
      return await lastValueFrom(this.grpcUser.findOne({ address }));
    } catch (err) {
      if (err?.code === GrpcStatus.NOT_FOUND) return null;
      else throw err;
    }
  }

  async resyncOwners(smartContractAddress: string, tokenIds?: string[]) {
    for (let skip = 0; ; skip += 1000) {
      const editions = await this.prisma.edition.findMany({
        where: {
          smartContractAddress,
          tokenId: tokenIds ? { in: tokenIds } : undefined,
        },
        select: { smartContractAddress: true, editionId: true },
        orderBy: [{ smartContractAddress: 'asc' }, { tokenId: 'asc' }],
        skip,
      });

      if (!editions?.length) break;

      await this.collectionResyncQueue.addBulk(
        editions.map((data) => ({ name: 'resyncOwner', data })),
      );
    }
  }

  async resyncStaking(smartContractAddress: string, tokenIds?: string[]) {
    const collection = await this.prisma.collection.findUnique({
      where: { smartContractAddress },
      select: { stakingContractAddresses: true },
    });

    for (let skip = 0; ; skip += 1000) {
      const editions = await this.prisma.edition.findMany({
        where: {
          smartContractAddress,
          tokenId: tokenIds ? { in: tokenIds } : undefined,
        },
        select: { smartContractAddress: true, editionId: true },
        orderBy: [{ smartContractAddress: 'asc' }, { tokenId: 'asc' }],
        skip,
      });

      if (!editions?.length) break;

      await this.collectionResyncQueue.addBulk(
        editions.map(({ editionId, smartContractAddress }) => ({
          name: 'resyncStaking',
          data: {
            editionId,
            smartContractAddress,
            stakingContractAddresses: collection.stakingContractAddresses,
          },
        })),
      );
    }
  }

  async resyncAssets(smartContractAddress: string, tokenIds?: string[]) {
    if (!tokenIds) {
      const tokens = await this.prisma.token.findMany({
        select: { tokenId: true },
        where: { smartContractAddress },
      });

      tokenIds = tokens.map((t) => t.tokenId);
    }

    await this.collectionResyncQueue.addBulk(
      tokenIds.map((tokenId) => ({
        name: 'resyncAssets',
        data: { smartContractAddress, tokenId },
      })),
    );
  }
}
