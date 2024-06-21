import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  AuctionServiceController,
  AuctionServiceControllerMethods,
  GetAuctionHistoryArgs,
} from '@generated/ts-proto/services/auction';
import {
  BlockchainSyncAuctionServiceClient,
  BLOCKCHAIN_SYNC_AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/blockchain_sync_auction';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { AuctionStatus, Prisma, PrismaClient } from '@prisma/client/auction';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import ExtendedRpcException from 'common/extended-rpc-exception';
import {
  decodeSerializedJson,
  encodeSerializedJson,
} from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';
import { AuctionService } from './auction.service';

@Controller()
@AuctionServiceControllerMethods()
export class AuctionController
  implements OnModuleInit, AuctionServiceController
{
  private readonly logger = new Logger(AuctionController.name);

  private grpcEdition: EditionServiceClient;
  private grpcBlockchainSyncAuction: BlockchainSyncAuctionServiceClient;

  constructor(
    @Inject(REDIS_CLIENT_PROXY)
    private readonly client: ClientProxy,

    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION)
    private readonly blockchainSyncAuctionClient: ClientGrpc,

    private readonly prisma: PrismaClient,
    private readonly auctionService: AuctionService,
  ) {}

  onModuleInit() {
    this.grpcBlockchainSyncAuction =
      this.blockchainSyncAuctionClient.getService(
        BLOCKCHAIN_SYNC_AUCTION_SERVICE_NAME,
      );

    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
  }

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.AuctionFindUniqueArgs>(args);
    const auction = await this.prisma.auction.findUnique(params);

    if (!auction) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find auction "${params.where.auctionId}"`,
      });
    }

    return this.auctionService.prismaAuctionToGrpc(auction);
  }

  async findFirst(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.AuctionFindFirstArgs>(args);
    const auction = await this.prisma.auction.findFirst(params);

    if (!auction) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find auction "${params.where.auctionId}"`,
      });
    }

    return this.auctionService.prismaAuctionToGrpc(auction);
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.AuctionFindManyArgs>(args);
    const auctions = await this.prisma.auction.findMany(params);

    return { auctions: auctions.map(this.auctionService.prismaAuctionToGrpc) };
  }

  async upsert(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.AuctionUpsertArgs>(args);

    const auctionSnapshot = await this.prisma.auction.findUnique({
      where: { auctionId: params.where.auctionId },
      rejectOnNotFound: false,
    });

    const auction = await this.prisma.auction.upsert(params);

    try {
      await this.auctionService.scheduleAuctionEnd(auction);
      await this.auctionService.scheduleAuctionEndingSoon(auction);
    } catch (err) {
      this.logger.warn(
        `Couldn't schedule the cronjobs for auction #${auction.auctionId}`,
        err,
      );
    }

    // The auction has been settled, update the edition owner and the updatedAt block number
    if (
      auctionSnapshot &&
      auctionSnapshot.status !== auction.status &&
      auction.status === AuctionStatus.SETTLED
    ) {
      // If the auction was won by someone, the new owner will be "highestBidderAddress"
      // otherwise it will return to the seller indicated by "sellerAddress"
      const newOwner = auction.highestBidderAddress || auction.sellerAddress;

      await lastValueFrom(
        this.grpcEdition
          .update(
            encodeSerializedJson<PrismaNft.EditionUpdateArgs>({
              where: {
                editionId_smartContractAddress: {
                  editionId: auction.editionId,
                  smartContractAddress: auction.smartContractAddress,
                },
              },
              data: { ownerAddress: newOwner, updatedAt: auction.updatedAt },
            }),
          )
          .pipe(
            catchError((err) => {
              this.logger.warn(
                `Error while updating token #${auction.editionId} of ${auction.smartContractAddress} for auction #${auction.auctionId}`,
                err,
              );

              return of(null);
            }),
          ),
      );
    }

    await lastValueFrom(
      this.client.send('UpdateAuction', { auctionId: auction.auctionId }).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.upsert.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    // Handle email send
    await this.auctionService.handleSendEmail(auctionSnapshot, auction);

    return this.auctionService.prismaAuctionToGrpc(auction);
  }

  async history(args: GetAuctionHistoryArgs) {
    return await lastValueFrom(
      this.grpcBlockchainSyncAuction.getAuctionHistory(args).pipe(
        catchError((err) => {
          this.logger.warn(
            `[${this.history.name}] Error while fetching auction history`,
            err,
          );

          return of({ history: null });
        }),
      ),
    );
  }
}
