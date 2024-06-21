import { BlockchainSyncBaseConsumer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaSale } from '@prisma/client/sale';
import { Job } from 'bullmq';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import { SaleService } from './sale.service';

@Processor('blockchain/sale', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.SALE_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class SaleConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(SaleConsumer.name);
  private grpcSale: SaleServiceClient;

  constructor(
    @Inject(GrpcClientKind.SALE) private readonly saleClient: ClientGrpc,
    private readonly saleService: SaleService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'listing':
      case 'purchase':
      case 'cancel':
        return await this.onSaleEvent(job, 'v2');
      case 'listingNonCustodial':
      case 'purchaseNonCustodial':
      case 'cancelNonCustodial':
        return await this.onSaleEvent(job, 'v3');
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onSaleEvent(job: Job, version: 'v2' | 'v3') {
    const saleData = await this.saleService.getSale(
      job.data.returnValues.saleId,
      job.data.returnValues.tokenId,
      job.data.returnValues.nft,
      version,
    );

    return await lastValueFrom(
      this.grpcSale.upsert(
        encodeSerializedJson<PrismaSale.SaleUpsertArgs>({
          where: { saleId: saleData.saleId },
          create: saleData as PrismaSale.SaleCreateInput,
          update: saleData as PrismaSale.SaleCreateInput,
        }),
      ),
    );
  }
}
