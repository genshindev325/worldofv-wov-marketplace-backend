import { FileUploadService } from '@app/file-upload';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard, GqlAuthGuard, GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import {
  MarketplaceServiceClient,
  MARKETPLACE_SERVICE_NAME,
} from '@generated/ts-proto/services/marketplace';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { User } from '@generated/ts-proto/types/user';
import { Metadata, status as GrpcStatus, status } from '@grpc/grpc-js';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
  UseGuards,
} from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import assert from 'assert';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { ReSyncResult } from '../common/resync-result.response';
import { CollectionResyncArgs } from './collection-resync.args';
import { CollectionType } from './collection-type.enum';
import { CollectionDTO } from './collection.response';
import { DeleteCollectionArgs } from './delete-collection.args';
import { FindOneCollectionArgs } from './find-one-collection.args';
import { CollectionTokenAttributesItem } from './get-collection-attributes.response';
import { GetCollectionStatsResponse } from './get-collection-stats.response';
import { GetCollectionsArgs } from './get-collections.args';
import { GetCollectionsResponse } from './get-collections.response';
import { GetWoVCollectionsArgs } from './get-wov-collections.args';
import {
  AdminUpdateCollectionArgs,
  UpdateCollectionArgs,
} from './update-collection.args';

@Resolver(() => CollectionDTO)
export class CollectionsResolver implements OnModuleInit {
  private readonly logger = new Logger(CollectionsResolver.name);

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_SLOW_CACHE_TTL) || 0;

  private grpcCollection: CollectionServiceClient;
  private grpcMarketplace: MarketplaceServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.MARKETPLACE)
    private readonly marketplaceClient: ClientGrpc,

    private readonly fileUploadService: FileUploadService,
  ) {}

  onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);

    this.grpcMarketplace = this.marketplaceClient.getService(
      MARKETPLACE_SERVICE_NAME,
    );
  }

  @Query(() => CollectionDTO, { nullable: true })
  @CacheControl(CollectionsResolver.CACHE_TTL)
  async getCollection(@Args() args: FindOneCollectionArgs) {
    return await lastValueFrom(
      this.grpcCollection.findOne(args).pipe(
        catchError((err) => {
          if (err?.code === GrpcStatus.NOT_FOUND) {
            return of(null);
          } else {
            return throwError(() => err);
          }
        }),
      ),
    );
  }

  @ResolveField()
  async isStakingActive(@Parent() getCollection: any) {
    const { stakingEndDate } = getCollection;
    if (stakingEndDate == null) return false;
    return new Date(stakingEndDate) >= new Date();
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => GetCollectionsResponse)
  @CacheControl(CollectionsResolver.CACHE_TTL)
  async getCollections(
    @Args() args: GetCollectionsArgs,
    @CurrentUser() user?: User,
  ) {
    assert(args.filters, 'Filters are required');

    const metadata = new Metadata();
    metadata.add('user_address', user?.address);
    metadata.add('is_admin', user?.isAdmin?.toString());

    const { items, meta } = await lastValueFrom(
      this.grpcMarketplace.getCollections(args, metadata),
    );

    return {
      items: items || [],
      meta,
    };
  }

  @Query(() => [CollectionDTO], { nullable: true })
  @CacheControl(0)
  async getWoVCollections(@Args() args: GetWoVCollectionsArgs) {
    return await this.grpcCollection
      .getWoVCollections(args)
      .pipe(map((val) => val?.items || []));
  }

  // Note: this is not used in the frontend but must remain here since it's
  // used by the volume script to fetch all imported collections.
  @Query(() => [CollectionDTO], { nullable: true })
  @CacheControl(0)
  async getAllPfpCollections() {
    return this.grpcCollection
      .findMany(
        encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
          where: { type: 'EXTERNAL' },
        }),
      )
      .pipe(map(({ collections }) => collections || []));
  }

  @Query(() => [CollectionTokenAttributesItem], { nullable: true })
  @CacheControl(CollectionsResolver.CACHE_TTL)
  async getCollectionTokenAttributes(@Args() args: FindOneCollectionArgs) {
    return await this.grpcCollection
      .getTokenAttributes(args)
      .pipe(map((res) => res.attributes || null));
  }

  @Query(() => GetCollectionStatsResponse, { nullable: true })
  @CacheControl(CollectionsResolver.CACHE_TTL)
  async getCollectionStats(@Args() args: FindOneCollectionArgs) {
    return await this.grpcCollection.getStats(args);
  }

  @UseGuards(GqlUserGuard)
  @Mutation(() => CollectionDTO)
  async updateCollection(
    @Args() args: UpdateCollectionArgs,
    @CurrentUser() user: User,
  ) {
    if (!args.collectionId && !args.name) {
      throw new BadRequestException(
        'Expected at most one argument between "collectionId" and "name"',
      );
    }

    if (args.collectionId && args.name) {
      throw new BadRequestException(
        `Expected only one argument between "collectionId" and "name"`,
      );
    }

    const collection = await lastValueFrom(
      this.grpcCollection
        .findFirst(
          encodeSerializedJson<PrismaNft.CollectionFindFirstArgs>({
            where: {
              OR: {
                collectionId: args.collectionId,
                name: args.name,
              },
              creatorAddress: user.address,
            },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === status.NOT_FOUND) {
              return of(null);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    const thumbnailImageUrl = args.thumbnailImage
      ? await this.fileUploadService.uploadGql({
          file: args.thumbnailImage,
          path: 'image/collection/thumbnail/',
          previousUrl: collection?.thumbnailImageUrl,
        })
      : undefined;

    const bannerImageUrl = args.bannerImage
      ? await this.fileUploadService.uploadGql({
          file: args.bannerImage,
          path: 'image/collection/banner/',
          previousUrl: collection?.bannerImageUrl,
        })
      : undefined;

    const now = Math.floor(Date.now() / 1000);

    // If the collection exists update it
    if (collection) {
      return await this.grpcCollection.update(
        encodeSerializedJson<PrismaNft.CollectionUpdateArgs>({
          where: { collectionId: collection.collectionId },
          data: {
            name: args.name,
            description: args.description,
            isVisible: args.isVisible,
            thumbnailImageUrl,
            bannerImageUrl,
            updatedAt: now,
          },
        }),
      );
    }

    // Else create it
    return await this.grpcCollection.create(
      encodeSerializedJson<PrismaNft.CollectionCreateArgs>({
        data: {
          name: args.name,
          description: args.description,
          isVisible: args.isVisible,
          creatorAddress: user.address,
          type: CollectionType.MARKETPLACE,
          thumbnailImageUrl,
          bannerImageUrl,
          updatedAt: now,
          createdAt: now,
        },
      }),
    );
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => CollectionDTO)
  async adminUpdateCollection(
    @Args()
    { collectionId, brandId, isWoVCollection }: AdminUpdateCollectionArgs,
  ) {
    const data: PrismaNft.CollectionUncheckedUpdateInput = {};

    if (typeof isWoVCollection === 'boolean') {
      data.isWoVCollection = isWoVCollection;
    }

    if (typeof brandId === 'string') {
      data.brandId = brandId !== '' ? brandId : null;
    }

    return await this.grpcCollection.update(
      encodeSerializedJson<PrismaNft.CollectionUpdateArgs>({
        where: { collectionId },
        data,
      }),
    );
  }

  @UseGuards(GqlUserGuard)
  @Mutation(() => ReSyncResult)
  async deleteCollection(
    @Args() args: DeleteCollectionArgs,
    @CurrentUser() user: User,
  ) {
    const collection = await lastValueFrom(
      this.grpcCollection
        .findFirst(
          encodeSerializedJson<PrismaNft.CollectionFindFirstArgs>({
            where: { collectionId: args.collectionId },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === status.NOT_FOUND) {
              return of(null);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    if (!collection) {
      throw new NotFoundException(
        `Couldn't find any collection with id ${args.collectionId}`,
      );
    }

    if (!isSameAddress(collection.creatorAddress, user.address)) {
      throw new ForbiddenException(`You're not the owner of this collection`);
    }

    return await this.grpcCollection.delete(
      encodeSerializedJson<PrismaNft.CollectionDeleteArgs>({
        where: { collectionId: collection.collectionId },
      }),
    );
  }

  @UseGuards(GqlAdminGuard)
  @Query(() => ReSyncResult)
  @CacheControl(0)
  async resyncCollectionOwners(@Args() args: CollectionResyncArgs) {
    return lastValueFrom(
      this.grpcCollection
        .resyncOwners(args)
        .pipe(map(() => of({ done: true }))),
    );
  }

  @UseGuards(GqlAdminGuard)
  @Query(() => ReSyncResult)
  @CacheControl(0)
  async resyncCollectionStaking(@Args() args: CollectionResyncArgs) {
    return lastValueFrom(
      this.grpcCollection
        .resyncStaking(args)
        .pipe(map(() => of({ done: true }))),
    );
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => ReSyncResult)
  async resyncCollectionAssets(@Args() args: CollectionResyncArgs) {
    return lastValueFrom(
      this.grpcCollection
        .resyncAssets(args)
        .pipe(map(() => of({ done: true }))),
    );
  }
}
