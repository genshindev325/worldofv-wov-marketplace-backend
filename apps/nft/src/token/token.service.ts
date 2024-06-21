import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  GenesisCount,
  GetGenerationRateArgs,
  GetGenesisCountBySetArgs,
  OverrideTokenMetadataArgs,
  SearchTokensByStringArgs,
  UpsertTokenArgs,
  UpsertTokenData,
} from '@generated/ts-proto/services/nft';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import { Token } from '@generated/ts-proto/types/token';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import {
  CollectionType,
  Prisma,
  PrismaClient,
  Token as PrismaToken,
  TokenCategory,
} from '@prisma/client/nft';
import { PromisePool } from '@supercharge/promise-pool';
import _ from 'lodash';
import { catchError, lastValueFrom, of } from 'rxjs';

@Injectable()
export class TokenService implements OnModuleInit {
  private readonly batchOperationConcurrency =
    Number(process.env.NFT_BATCH_OPERATION_CONCURRENCY) || 20;

  private readonly logger = new Logger(TokenService.name);
  private grpcImageThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceClient: ClientProxy,

    private readonly prisma: PrismaClient,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  prismaTokenToGrpc({
    attributes,
    stakingEarnings,
    ...token
  }: PrismaToken): Token {
    // All properties are optional since the request from the client might
    // select only specific fields from the database.
    return {
      ...token,
      attributes: attributes as any,
      stakingEarnings: stakingEarnings?.toFixed(0),
      editions: [],
    };
  }

  async findOne(
    where: Prisma.TokenWhereUniqueInput,
  ): Promise<PrismaToken | null> {
    return this.prisma.token.findUnique({ where });
  }

  async exists(where: Prisma.TokenWhereInput): Promise<boolean> {
    const count = await this.prisma.token.count({ where });
    return !!count;
  }

  async upsert(
    where: Prisma.TokenWhereUniqueInput,
    data: Prisma.TokenCreateInput,
  ): Promise<PrismaToken> {
    const updateEditions: any = (
      data.editions.create as Prisma.EditionCreateWithoutTokenInput[]
    )?.map((edition) => ({
      where: {
        editionId_smartContractAddress: {
          editionId: edition.editionId,
          smartContractAddress: data.smartContractAddress,
        },
      },
      data: edition,
    }));

    return this.prisma.token.upsert({
      where,
      update: { ...data, editions: { update: updateEditions } },
      create: data,
    });
  }

  async create(data: any): Promise<any> {
    return this.prisma.token.create(data);
  }

  async upsertCollectionFromTokenData(data: UpsertTokenData) {
    const blockchainId = data.tokenId.replace(/.{8}$/, '00000000');

    const whereCollection: Prisma.CollectionWhereInput[] = [{ blockchainId }];

    if (data.collectionName) {
      whereCollection.push({
        name: data.collectionName,
        creatorAddress: data.creatorAddress,
      });
    }

    const databaseCollection = await this.prisma.collection.findFirst({
      where: { OR: whereCollection },
      rejectOnNotFound: false,
    });

    if (!data.collectionName) return null;

    const collectionData = {
      blockchainId: blockchainId,
      creatorAddress: data.creatorAddress,
      name: data.collectionName,
      type: CollectionType.MARKETPLACE,
    };

    if (databaseCollection) {
      return this.prisma.collection.update({
        where: { collectionId: databaseCollection.collectionId },
        data: collectionData,
      });
    } else {
      return this.prisma.collection.create({ data: collectionData });
    }
  }

  async resyncAssets(smartContractAddress: string, tokenId: string) {
    return await lastValueFrom(
      this.grpcImageThumbnail.createTokenAssets({
        smartContractAddress,
        tokenId,
      }),
    );
  }

  async getGenerationRateForUser({
    ownerAddress,
    smartContractAddress,
  }: GetGenerationRateArgs) {
    const response: any = await this.prisma.$queryRaw`
      SELECT SUM("stakingEarnings") as "stakingEarnings"
      FROM "Token" t
      INNER JOIN "Edition" e 
      ON t."smartContractAddress" = e."smartContractAddress" AND t."tokenId" = e."tokenId" 
      WHERE t."smartContractAddress" = ${smartContractAddress}::CITEXT AND e."ownerAddress" = ${ownerAddress}::CITEXT
    `;

    return response[0].stakingEarnings;
  }

  async getGenesisCountBySet({ ownerAddress }: GetGenesisCountBySetArgs) {
    return this.prisma.$queryRaw<GenesisCount[]>`
      WITH "sets_and_countries" AS (
        SELECT DISTINCT ON ("set", "country")
        jsonb_path_query("Token"."attributes", '$[*] ? (@.value == "Unclaimed")."trait_type"') AS "set",
        jsonb_path_query_first("Token"."attributes", '$[*] ? (@.trait_type == "Country")."value"') AS "country"
        FROM 
          "Token"
        LEFT JOIN "Edition" ON
          "Token"."smartContractAddress" = "Edition"."smartContractAddress"
          AND "Token"."tokenId" = "Edition"."tokenId"
        WHERE 
            "Token"."smartContractAddress" = ${process.env.WOW_GENESIS_CONTRACT_ADDRESS}::CITEXT
            AND "Edition"."ownerAddress" = ${ownerAddress}::CITEXT
      ) 
      SELECT "set", count("country")::INT
      FROM "sets_and_countries" 
      GROUP BY "set"
      `;
  }

  async searchTokensByString({ text, limit }: SearchTokensByStringArgs) {
    return this.prisma.token.findMany({
      include: {
        collection: true,
      },
      where: {
        name: {
          contains: text,
          mode: 'insensitive',
        },
        collection: {
          isVisible: true,
        },
      },
      take: limit,
    });
  }

  async upsertToken(args: UpsertTokenArgs) {
    let collection = undefined;

    // If it's a marketplace NFT use a custom logic else connect it
    if (
      args.data.smartContractAddress ===
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS
    ) {
      const databaseCollection = await this.upsertCollectionFromTokenData(
        args.data,
      );

      if (databaseCollection) {
        collection = {
          connect: { collectionId: databaseCollection.collectionId },
        };
      }
    } else if (args.data.collectionId) {
      collection = { connect: { collectionId: args.data.collectionId } };
      delete args.data.collectionId;
    }

    const editionsCountInQuery = args.data?.editions?.length;

    const editionsData:
      | Prisma.EditionCreateNestedManyWithoutTokenInput
      | Prisma.EditionUpdateManyWithoutTokenNestedInput = editionsCountInQuery
      ? {
          connectOrCreate: args.data.editions.map((edition) => ({
            where: {
              editionId_smartContractAddress: {
                editionId: edition.editionId,
                smartContractAddress:
                  edition.smartContractAddress ||
                  args.data.smartContractAddress,
              },
            },
            create: _.omit(edition, ['tokenId', 'smartContractAddress']),
          })),
        }
      : undefined;

    const categories = args.data.categories?.map(
      (c) => c.toUpperCase() as TokenCategory,
    );

    const tokenData: Prisma.TokenCreateInput | Prisma.TokenUpdateInput = {
      tokenId: args.data.tokenId,
      smartContractAddress: args.data.smartContractAddress,
      name: args.data.name,
      description: args.data.description,
      creatorAddress: args.data.creatorAddress,
      editionsCount: args.data.editionsCount,
      royalty: args.data.royalty,
      categories: categories,
      attributes: args.data.attributes as any,
      score: args.data.score,
      rank: args.data.rank,
      mintedAt: args.data.mintedAt || -1,
      stakingEarnings: args.data.stakingEarnings || null,
      collection,
      editions: editionsData,
    };

    // Wait for the original asset to be uploaded before creating the token.
    const asset = await lastValueFrom(
      this.grpcImageThumbnail.createTokenAssets({
        smartContractAddress: args.data.smartContractAddress,
        tokenId: args.data.tokenId,
        source: { url: args.data.sourceImageUrl },
      }),
    );

    tokenData.imageMimeType = asset.mimeType;
    tokenData.imageUrl = asset.url;

    const updateTokenData = Object.assign({}, tokenData);

    // TODO: Improve this logic to handle multi-edition tokens
    if (editionsCountInQuery === 1) {
      const edition = args.data.editions[0];

      updateTokenData.editions = {
        ...editionsData,
        update: {
          where: {
            editionId_smartContractAddress: {
              editionId: edition.editionId,
              smartContractAddress:
                edition.smartContractAddress || args.data.smartContractAddress,
            },
          },
          data: _.omit(edition, ['tokenId', 'smartContractAddress']),
        },
      };
    }

    const token = await this.prisma.token
      .upsert({
        where: { tokenId_smartContractAddress: args.where },
        create: tokenData as Prisma.TokenCreateInput,
        update: updateTokenData as Prisma.TokenUpdateInput,
      })
      .catch((error) => {
        this.logger.error(
          `Error while upsert token to the database method for ${args.where.tokenId} - ${args.where.smartContractAddress}`,
          error,
        );

        throw error;
      });

    await lastValueFrom(
      this.marketplaceClient
        .send('UpdateToken', {
          tokenId: token.tokenId,
          smartContractAddress: token.smartContractAddress,
        })
        .pipe(
          catchError((err) => {
            this.logger.error(
              `[${this.upsert.name}] Error while updating marketplace via Redis`,
              err,
            );
            return of(null);
          }),
        ),
    );

    return this.prismaTokenToGrpc(token);
  }

  async deleteToken(smartContractAddress: string, tokenId: string) {
    // Make sure we don't delete everything by mistake.
    if (!tokenId || !smartContractAddress) {
      throw new Error(`[${this.deleteToken.name}] Wrong argument format`);
    }

    try {
      await this.prisma.token.delete({
        where: {
          tokenId_smartContractAddress: { tokenId, smartContractAddress },
        },
      });

      await lastValueFrom(
        this.grpcImageThumbnail
          .deleteTokenAssets({
            smartContractAddress,
            tokenId,
          })
          .pipe(
            catchError((err) => {
              this.logger.error(
                `[${this.deleteToken.name}] Error while removing leftover assets.`,
                err,
              );
              return of(null);
            }),
          ),
      );

      await lastValueFrom(
        this.marketplaceClient
          .send('DeleteToken', { tokenId, smartContractAddress })
          .pipe(
            catchError((err) => {
              this.logger.error(
                `[${this.deleteToken.name}] Error while updating marketplace via Redis`,
                err,
              );
              return of(null);
            }),
          ),
      );

      return { deleted: true };
    } catch (error) {
      if (error?.code === 'P2025' /** Not found */) return { deleted: false };
      throw error;
    }
  }

  async overrideMetadata({
    smartContractAddress,
    metadata,
  }: OverrideTokenMetadataArgs) {
    return PromisePool.for(metadata)
      .withConcurrency(this.batchOperationConcurrency)
      .handleError((error: any, { tokenId }) => {
        if (error?.code === 'P2025' /** Not found */) {
          this.logger.warn(
            `Skipping metadata override for token ${tokenId} since it was not found in the database.`,
          );
        } else {
          throw error;
        }
      })
      .process(async ({ tokenId, rank, score }) => {
        await this.prisma.token.update({
          data: {
            rank: typeof rank === 'number' ? rank : null,
            score: typeof score === 'number' ? score : null,
          },
          where: {
            tokenId_smartContractAddress: { tokenId, smartContractAddress },
          },
        });

        await lastValueFrom(
          this.marketplaceClient
            .send('UpdateTokenMetadata', { tokenId, smartContractAddress })
            .pipe(
              catchError((err) => {
                this.logger.error(
                  `[${this.overrideMetadata.name}] Error while updating marketplace via Redis`,
                  err,
                );
                return null;
              }),
            ),
        );
      });
  }
}
