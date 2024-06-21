import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SaleService } from './sale.service';

@Injectable()
export class SaleProducer
  extends BlockchainSyncBaseProducer
  implements OnApplicationBootstrap
{
  protected readonly logger = new Logger(SaleProducer.name);

  constructor(
    @InjectQueue('blockchain/sale')
    protected readonly queue: Queue,
    private readonly saleService: SaleService,
  ) {
    super(queue);
  }

  async onApplicationBootstrap() {
    await this.handleEvents({
      contract: this.saleService.contract_v2,
      eventName: 'listing',
    });

    await this.handleEvents({
      contract: this.saleService.contract_v2,
      eventName: 'purchase',
    });

    await this.handleEvents({
      contract: this.saleService.contract_v2,
      eventName: 'cancel',
    });

    await this.handleEvents({
      contract: this.saleService.contract_v3,
      eventName: 'listingNonCustodial',
    });

    await this.handleEvents({
      contract: this.saleService.contract_v3,
      eventName: 'purchaseNonCustodial',
    });

    await this.handleEvents({
      contract: this.saleService.contract_v3,
      eventName: 'cancelNonCustodial',
    });
  }
}
