import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { OfferService } from './offer.service';

@Injectable()
export class OfferProducer
  extends BlockchainSyncBaseProducer
  implements OnApplicationBootstrap
{
  constructor(
    @InjectQueue('blockchain/offer')
    protected readonly queue: Queue,

    private readonly offerService: OfferService,
  ) {
    super(queue);
  }

  async onApplicationBootstrap() {
    await this.handleEvents({
      contract: this.offerService.contract,
      eventName: 'NewBuyOffer',
    });

    await this.handleEvents({
      contract: this.offerService.contract,
      eventName: 'CloseBuyOffer',
    });

    await this.handleEvents({
      contract: this.offerService.contract,
      eventName: 'OfferAccepted',
    });
  }
}
