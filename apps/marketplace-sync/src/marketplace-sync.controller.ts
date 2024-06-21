import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  AuctionServiceClient,
  AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/auction';
import { FindOneTokenArgs } from '@generated/ts-proto/services/marketplace';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { User } from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  Controller,
  Inject,
  Logger,
  OnModuleInit,
  UseInterceptors,
} from '@nestjs/common';
import { ClientGrpc, MessagePattern } from '@nestjs/microservices';
import { Prisma as PrismaAuction } from '@prisma/client/auction';
import { AssetEntityKind } from '@prisma/client/image-thumbnail';
import { CollectionsType } from '@prisma/client/marketplace';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Offer } from '@prisma/client/offer';
import { Prisma as PrismaSale } from '@prisma/client/sale';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { AssetEntity } from 'apps/image-thumbnail/src/create-asset-job-data.type';
import { encodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import { MarketplaceSyncInterceptor } from './marketplace-sync.interceptor';
import { MarketplaceSyncService } from './marketplace-sync.service';
import PrismaClientMarketplaceSync from './prisma-client-marketplace-sync';

@Controller()
@UseInterceptors(MarketplaceSyncInterceptor)
export class MarketplaceSyncController implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceSyncController.name);

  private grpcToken: TokenServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcAuction: AuctionServiceClient;
  private grpcSale: SaleServiceClient;
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.AUCTION)
    private readonly auctionClient: ClientGrpc,

    @Inject(GrpcClientKind.SALE)
    private readonly saleClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    private readonly prisma: PrismaClientMarketplaceSync,
    private readonly marketplaceService: MarketplaceSyncService,
  ) {}

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);
    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  @MessagePattern('UpdateUser')
  async updateUser(user: User) {
    return this.marketplaceService.updateUser(user);
  }

  @MessagePattern('UpdateToken')
  async updateToken(args: FindOneTokenArgs) {
    return await this.marketplaceService.updateToken(
      args.smartContractAddress,
      args.tokenId,
    );
  }

  @MessagePattern('DeleteToken')
  async deleteToken(args: FindOneTokenArgs) {
    try {
      await this.prisma.$transaction([
        this.prisma.tokens.delete({
          where: { tokenId_smartContractAddress: args },
        }),
        this.prisma.editions.deleteMany({
          where: args,
        }),
      ]);

      return true;
    } catch (error) {
      if (error?.code === 'P2025' /** Not found */) return false;
      throw error;
    }
  }

  @MessagePattern('UpdateTokenMetadata')
  async updateTokenMetadata(args: FindOneTokenArgs) {
    // Get the token
    const token = await lastValueFrom(this.grpcToken.findOne(args));

    return await this.prisma.tokens.update({
      where: {
        tokenId_smartContractAddress: {
          tokenId: token.tokenId,
          smartContractAddress: token.smartContractAddress,
        },
      },
      data: {
        name: token.name,
        attributes: token.attributes as any,
        score: token.score,
        rank: token.rank,
      },
    });
  }

  @MessagePattern('UpdateSale')
  async updateSale(args: { saleId: string }) {
    const sale = await lastValueFrom(
      this.grpcSale.findUnique(
        encodeSerializedJson<PrismaSale.SaleFindUniqueArgs>({
          where: { saleId: args.saleId },
        }),
      ),
    );

    return await this.updateToken({
      tokenId: sale.tokenId,
      smartContractAddress: sale.smartContractAddress,
    });
  }

  @MessagePattern('UpdateAuction')
  async updateAuction(args: { auctionId: string }) {
    const auction = await lastValueFrom(
      this.grpcAuction.findUnique(
        encodeSerializedJson<PrismaAuction.AuctionFindUniqueArgs>({
          where: { auctionId: args.auctionId },
        }),
      ),
    );

    return await this.updateToken({
      tokenId: auction.tokenId,
      smartContractAddress: auction.smartContractAddress,
    });
  }

  @MessagePattern('UpdateOffer')
  async updateOffer(offer: Offer) {
    await this.marketplaceService.updateOffer(offer);
    return {};
  }

  @MessagePattern('UpdateAsset')
  async updateAsset(args: AssetEntity) {
    switch (args.kind) {
      case AssetEntityKind.TOKEN: {
        const entityId = {
          smartContractAddress: args.smartContractAddress,
          tokenId: args.tokenId,
        };

        const token = await this.prisma.tokens.findUnique({
          where: {
            tokenId_smartContractAddress: entityId,
          },
        });

        // If the token doesn't exists, call the sync method for the token that will fetch the media too
        if (!token) {
          return await this.updateToken(entityId);
        }

        // Else fetch the media only from the microservice and update them
        const media = await this.marketplaceService.getTokenMedia(
          args.tokenId,
          args.smartContractAddress,
        );

        return await this.prisma.tokens.update({
          where: { tokenId_smartContractAddress: entityId },
          data: { media },
        });
      }

      case AssetEntityKind.USER_BANNER: {
        return null;
      }

      case AssetEntityKind.USER_AVATAR: {
        const user = await lastValueFrom(
          this.grpcUser
            .findUnique(
              encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
                where: { address: args.address },
              }),
            )
            .pipe(
              catchError((err) => {
                if (err?.code === GrpcStatus.NOT_FOUND) {
                  return of(null);
                } else {
                  return throwError(() => err);
                }
              }),
            ),
        );

        if (user) {
          return this.updateUser(user);
        } else {
          return null;
        }
      }

      default: {
        throw new Error('Unimplemented.');
      }
    }
  }

  @MessagePattern('UpdateCollection')
  async updateCollection(args: { collectionId: string; deleted?: boolean }) {
    // If the UpdateCollection is sent as 'deleted' remove the collection from the database
    if (args.deleted) {
      return await this.prisma.collections.delete({
        where: { collectionId: args.collectionId },
      });
    }

    // Fetch the collection from the NFT microservice
    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          where: { collectionId: args.collectionId },
        }),
      ),
    );

    const collectionData = {
      collectionId: collection.collectionId,
      blockchainId: collection.blockchainId,
      smartContractAddress: collection.smartContractAddress,
      creatorAddress: collection.creatorAddress,
      name: collection.name,
      customUrl: collection.customUrl,
      thumbnailImageUrl: collection.thumbnailImageUrl,
      isVerified: collection.isVerified,
      isVisible: collection.isVisible,
      type: collection.type as CollectionsType,
      importedAt: collection.importedAt,
      stakingContractAddresses: collection.stakingContractAddresses,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };

    return await this.prisma.collections.upsert({
      where: { collectionId: collection.collectionId },
      create: collectionData,
      update: collectionData,
    });
  }
}
