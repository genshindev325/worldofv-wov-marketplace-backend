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
import { Collection } from '@generated/ts-proto/types/collection';
import { Token } from '@generated/ts-proto/types/token';
import { User } from '@generated/ts-proto/types/user';
import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaAdmin, PrismaClient } from '@prisma/client/admin';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom, map } from 'rxjs';
import Web3 from 'web3';

@Injectable()
export class VerifiedDropService {
  private grpcUser: UserServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    private readonly prisma: PrismaClient,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  /**
   * @returns Map [token id] -> [asset]
   */
  async fetchAssets(tokenIds: string[]) {
    const assetsById = new Map<string, Asset>();

    await Promise.all(
      tokenIds?.map(async (tokenId) => {
        const asset = await lastValueFrom(
          this.grpcImageThumbnail
            .getTokenAssets({
              smartContractAddress: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
              tokenId,
              filters: {
                sizes: [AssetSize.STATIC_COVER_512, AssetSize.ORIGINAL],
              },
            })
            .pipe(map(({ assets }) => assets?.[0])),
        );

        if (asset) assetsById.set(tokenId, asset);
      }),
    );

    return assetsById;
  }

  async findMany(args: PrismaAdmin.VerifiedDropFindManyArgs) {
    const drops = await this.prisma.verifiedDrop.findMany(args);

    const collectionIds = drops.reduce((ids, drop) => {
      if (drop.collectionId) ids.push(drop.collectionId);
      return ids;
    }, []);

    const tokenIds = drops.reduce((ids, drop) => {
      if (drop.tokenId) ids.push(drop.tokenId);
      return ids;
    }, []);

    const [{ collections }, { tokens }, assetsByTokenId] = await Promise.all([
      lastValueFrom(
        this.grpcCollection.findMany(
          encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
            where: { collectionId: { in: collectionIds } },
          }),
        ),
      ),

      lastValueFrom(
        this.grpcToken.findMany(
          encodeSerializedJson<PrismaNft.TokenFindManyArgs>({
            where: {
              tokenId: { in: tokenIds },
              smartContractAddress: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
            },
          }),
        ),
      ),

      this.fetchAssets(tokenIds),
    ]);

    const artistAddresses = new Set<string>();

    for (const drop of drops || []) {
      if (drop.address) artistAddresses.add(drop.address);
    }

    for (const coll of collections || []) {
      if (coll.creatorAddress) artistAddresses.add(coll.creatorAddress);
    }

    for (const token of tokens || []) {
      artistAddresses.add(token.creatorAddress);
    }

    const { users: artists } = await lastValueFrom<{ users: User[] }>(
      this.grpcUser.findMany(
        encodeSerializedJson<PrismaUser.UserFindManyArgs>({
          where: { address: { in: Array.from(artistAddresses) } },
        }),
      ),
    );

    const collectionsById = collections?.reduce(
      (byId, collection) => byId.set(collection.collectionId, collection),
      new Map<string, Collection>(),
    );

    const tokensById = tokens?.reduce(
      (byId, token) => byId.set(token.tokenId, token),
      new Map<string, Token>(),
    );

    const artistsByAddress = artists?.reduce(
      (byId, user) =>
        byId.set(Web3.utils.toChecksumAddress(user.address), user),
      new Map<string, User>(),
    );

    return drops.map((drop) => {
      const collection = collectionsById?.get(drop.collectionId);
      const token = tokensById?.get(drop.tokenId);

      let asset: Asset;

      if (assetsByTokenId?.has(drop.tokenId)) {
        asset = assetsByTokenId?.get(drop.tokenId);
      } else {
        const url = drop.imageUrl || collection.thumbnailImageUrl;

        if (url) {
          asset = { size: AssetSize.ORIGINAL, url, mimeType: 'image/*' };
        }
      }

      const creatorAddress = Web3.utils.toChecksumAddress(
        drop.address || collection?.creatorAddress || token?.creatorAddress,
      );

      const artist = artistsByAddress?.get(creatorAddress);

      return {
        ...drop,
        dateTime: drop.dateTime.toISOString(),
        collection,
        token,
        asset,
        artist,
      };
    });
  }

  async upsert(args: PrismaAdmin.VerifiedDropCreateInput) {
    if (args.id) {
      const existing = await this.delete(args.id);
      if (!existing) return null;
    }

    return this.prisma.$transaction(async (prisma) => {
      // Make sure we don't have holes between positions.
      const count = await prisma.verifiedDrop.count();
      args.position = Math.min(args.position, count + 1);

      await prisma.verifiedDrop.updateMany({
        where: { position: { gte: args.position } },
        data: { position: { increment: 1 } },
      });

      const created = await prisma.verifiedDrop.create({ data: args });

      return {
        ...created,
        dateTime: created.dateTime.toISOString(),
      };
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (prisma) => {
      const existing = await prisma.verifiedDrop.findUnique({
        where: { id },
      });

      if (!existing) return null;

      const deleted = await prisma.verifiedDrop.deleteMany({
        where: { position: existing.position },
      });

      if (deleted.count) {
        await prisma.verifiedDrop.updateMany({
          where: { position: { gt: existing.position } },
          data: { position: { decrement: 1 } },
        });
      }

      return existing;
    });
  }

  async tokenExists(tokenId: string) {
    return lastValueFrom(
      this.grpcToken
        .exists({
          tokenId,
          smartContractAddress: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
        })
        .pipe(map((v) => v.value)),
    );
  }

  async collectionExists(collectionId: string) {
    return lastValueFrom(
      this.grpcCollection
        .findMany(
          encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
            where: { collectionId },
            select: { collectionId: true },
          }),
        )
        .pipe(map((v) => !!v.collections?.length)),
    );
  }
}
