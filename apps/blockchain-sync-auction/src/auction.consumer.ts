import { BlockchainSyncBaseConsumer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  AuctionServiceClient,
  AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/auction';
import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaAuction } from '@prisma/client/auction';
import { Job } from 'bullmq';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import { AuctionService } from './auction.service';

@Processor('blockchain/auction', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.AUCTION_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class AuctionConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(AuctionConsumer.name);
  private grpcAuction: AuctionServiceClient;

  constructor(
    @Inject(GrpcClientKind.AUCTION) private readonly auctionClient: ClientGrpc,
    private readonly auctionService: AuctionService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'newAuction':
      case 'newBid':
      case 'cancelAuctionEvent':
      case 'timeUpdate':
      case 'auctionExecuted':
        return await this.onAuctionEvent(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onAuctionEvent(job: Job) {
    const auctionData = await this.auctionService.getAuction(
      job.data.returnValues.auctionId,
      job.data.returnValues.tokenId,
      job.data.returnValues.nft,
    );

    return await lastValueFrom(
      this.grpcAuction.upsert(
        encodeSerializedJson<PrismaAuction.AuctionUpsertArgs>({
          where: { auctionId: auctionData.auctionId },
          create: auctionData,
          update: auctionData,
        }),
      ),
    );
  }
}
