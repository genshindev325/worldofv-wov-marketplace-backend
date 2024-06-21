import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuctionService } from './auction.service';

@Injectable()
export class AuctionProducer
  extends BlockchainSyncBaseProducer
  implements OnApplicationBootstrap
{
  protected readonly logger = new Logger(AuctionProducer.name);

  constructor(
    @InjectQueue('blockchain/auction')
    protected readonly queue: Queue,

    private readonly auctionService: AuctionService,
  ) {
    super(queue);
  }

  async onApplicationBootstrap() {
    await this.handleEvents({
      contract: this.auctionService.contract,
      eventName: 'newAuction',
    });

    await this.handleEvents({
      contract: this.auctionService.contract,
      eventName: 'newBid',
    });

    await this.handleEvents({
      contract: this.auctionService.contract,
      eventName: 'cancelAuctionEvent',
    });

    await this.handleEvents({
      contract: this.auctionService.contract,
      eventName: 'timeUpdate',
    });

    await this.handleEvents({
      contract: this.auctionService.contract,
      eventName: 'auctionExecuted',
    });
  }
}
