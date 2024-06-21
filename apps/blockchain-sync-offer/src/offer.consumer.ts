import { BlockchainSyncBaseConsumer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  OfferServiceClient,
  OFFER_SERVICE_NAME,
} from '@generated/ts-proto/services/offer';
import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { TemplateKey } from '@prisma/client/email';
import { OfferStatus } from '@prisma/client/offer';
import { Job } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { OfferService } from './offer.service';

@Processor('blockchain/offer', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.OFFER_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class OfferConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(OfferConsumer.name);

  private grpcOffer: OfferServiceClient;

  constructor(
    @Inject(GrpcClientKind.OFFER) private readonly offerClient: ClientGrpc,
    private readonly offerService: OfferService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcOffer = this.offerClient.getService(OFFER_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'NewBuyOffer':
      case 'CloseBuyOffer':
      case 'OfferAccepted':
        return await this.onOfferEvent(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onOfferEvent(job: Job) {
    const offerData = await this.offerService.getOffer(
      job.data.returnValues.offerType,
      job.data.returnValues.offerId,
      job.data.returnValues.tokenId,
      job.data.returnValues.nft,
    );

    const offer = await lastValueFrom(
      this.grpcOffer.upsert({
        where: { offerId: offerData.offerId },
        data: offerData,
      }),
    );

    const emailType =
      offer.status === OfferStatus.ACTIVE
        ? TemplateKey.OFFER_RECEIVED
        : offer.status === OfferStatus.ACCEPTED
        ? TemplateKey.OFFER_ACCEPTED
        : undefined;

    try {
      // Send the email only if the offer is active (so it has been received)
      // or if it has been accepted
      if (emailType) {
        await lastValueFrom(
          this.grpcOffer.sendEmail({
            offerId: offer.offerId,
            emailType,
          }),
        );
      }
    } catch (err) {
      this.logger.error(`Error while sending email for ${emailType}`, err);
    }
  }
}
