import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import { S3Service } from '@app/s3';
import {
  CollectionResyncArgs,
  CollectionServiceController,
  CollectionServiceControllerMethods,
  FindOneCollectionArgs,
  SearchCollectionsByStringArgs,
  UpsertCollectionArgs,
} from '@generated/ts-proto/services/nft';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma, PrismaClient } from '@prisma/client/nft';
import { GetWoVCollectionsArgs } from 'apps/gateway/src/collections/get-wov-collections.args';
import { Queue } from 'bullmq';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { decodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';
import { CollectionService } from './collection.service';

@Controller()
@CollectionServiceControllerMethods()
export class CollectionController implements CollectionServiceController {
  private readonly logger = new Logger(CollectionController.name);

  constructor(
    @InjectQueue('nft/collection/resync')
    private readonly collectionResyncQueue: Queue,

    @Inject(REDIS_CLIENT_PROXY)
    private readonly client: ClientProxy,

    private readonly s3: S3Service,
    private readonly prisma: PrismaClient,
    private readonly collectionService: CollectionService,
  ) {}

  async findOne(args: FindOneCollectionArgs) {
    const collection = await this.collectionService.findOne(args);

    if (!collection) {
      const [k, v] = Object.entries(args)[0];

      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find any Collection where "${k}" is "${v}"`,
      });
    }

    const creator = collection.creatorAddress
      ? await this.collectionService.getCreator(collection.creatorAddress)
      : null;

    return {
      ...this.collectionService.prismaCollectionToGrpc(collection),
      creator,
    };
  }

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionFindUniqueArgs>(args);
    const collection = await this.prisma.collection.findUnique(params);

    if (!collection) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Collection does not exist.`,
      });
    }

    return this.collectionService.prismaCollectionToGrpc(collection);
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionFindManyArgs>(args);
    const collections = await this.prisma.collection.findMany(params);

    return {
      collections: collections.map(
        this.collectionService.prismaCollectionToGrpc,
      ),
    };
  }

  async findFirst(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionFindFirstArgs>(args);
    const collection = await this.prisma.collection.findFirst(params);

    if (!collection) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Collection does not exist.`,
      });
    }

    return this.collectionService.prismaCollectionToGrpc(collection);
  }

  async searchCollectionsByString(args: SearchCollectionsByStringArgs) {
    const collections = await this.collectionService.searchCollectionsByString(
      args,
    );
    return { collections };
  }

  async upsert(args: UpsertCollectionArgs) {
    const collection = await this.collectionService.upsert(
      args.where,
      args.data as any,
    );

    await lastValueFrom(
      this.client
        .send('UpdateCollection', { collectionId: collection.collectionId })
        .pipe(
          catchError((err) => {
            this.logger.warn(
              `[${this.upsert.name}] Error while updating marketplace via Redis`,
              err,
            );

            return of(null);
          }),
        ),
    );

    return this.collectionService.prismaCollectionToGrpc(collection);
  }

  async update(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionUpdateArgs>(args);

    const collection = await this.prisma.collection.update(params);

    await lastValueFrom(
      this.client
        .send('UpdateCollection', { collectionId: collection.collectionId })
        .pipe(
          catchError((err) => {
            this.logger.warn(
              `[${this.update.name}] Error while updating marketplace via Redis`,
              err,
            );

            return of(null);
          }),
        ),
    );

    return this.collectionService.prismaCollectionToGrpc(collection);
  }

  async create(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionCreateArgs>(args);

    const collection = await this.prisma.collection.create(params);

    await lastValueFrom(
      this.client
        .send('UpdateCollection', { collectionId: collection.collectionId })
        .pipe(
          catchError((err) => {
            this.logger.warn(
              `[${this.create.name}] Error while updating marketplace via Redis`,
              err,
            );

            return of(null);
          }),
        ),
    );

    return this.collectionService.prismaCollectionToGrpc(collection);
  }

  async delete(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.CollectionDeleteArgs>(args);
    const deletedCollection = await this.prisma.collection.delete(params);

    if (deletedCollection) {
      // Try to delete existing thumbnail and banner image url if exists
      try {
        if (deletedCollection.thumbnailImageUrl) {
          await this.s3.deleteObject({
            path: deletedCollection.thumbnailImageUrl,
          });
        }

        if (deletedCollection.bannerImageUrl) {
          await this.s3.deleteObject({
            path: deletedCollection.bannerImageUrl,
          });
        }
      } catch (err) {
        this.logger.warn(
          `An error occurred trying to delete collection assets`,
        );
      }

      await lastValueFrom(
        this.client
          .send('UpdateCollection', {
            collectionId: deletedCollection.collectionId,
            deleted: true,
          })
          .pipe(
            catchError((err) => {
              this.logger.warn(
                `[${this.delete.name}] Error while updating marketplace via Redis`,
                err,
              );

              return of(null);
            }),
          ),
      );

      return { done: true };
    }

    return { done: false };
  }

  async getWoVCollections(args: GetWoVCollectionsArgs) {
    const items = await this.collectionService.getWoVCollections(args);
    return {
      items: items.map(this.collectionService.prismaCollectionToGrpc),
    };
  }

  async getTokenAttributes(args: FindOneCollectionArgs) {
    const collection = await this.findOne(args);

    const attributes = await this.collectionService.getTokenAttributes(
      collection,
    );

    return { attributes };
  }

  async getStats(args: FindOneCollectionArgs) {
    const collection = await this.findOne(args);

    if (
      !collection.smartContractAddress ||
      collection.smartContractAddress ===
        process.env.WOV_MARKETPLACE_TOKEN_ADDRESS
    ) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: `This collection cannot have statistics`,
      });
    }

    return await this.collectionService.getStats(collection);
  }

  async resyncOwners({ smartContractAddress, tokenIds }: CollectionResyncArgs) {
    return this.collectionService.resyncOwners(smartContractAddress, tokenIds);
  }

  async resyncStaking({
    smartContractAddress,
    tokenIds,
  }: CollectionResyncArgs) {
    return this.collectionService.resyncStaking(smartContractAddress, tokenIds);
  }

  async resyncAssets({ smartContractAddress, tokenIds }: CollectionResyncArgs) {
    return this.collectionService.resyncAssets(smartContractAddress, tokenIds);
  }
}
