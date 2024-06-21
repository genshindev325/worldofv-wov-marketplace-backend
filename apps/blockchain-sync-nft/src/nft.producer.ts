import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TokenService } from './token.service';

@Injectable()
export class NftProducer
  extends BlockchainSyncBaseProducer
  implements OnApplicationBootstrap
{
  protected readonly logger = new Logger(NftProducer.name);

  constructor(
    @InjectQueue('blockchain/nft') protected readonly queue: Queue,
    private readonly tokenService: TokenService,
  ) {
    super(queue);
  }

  async onApplicationBootstrap() {
    await this.handleEvents({
      contract: this.tokenService.wovNftContract,
      eventName: 'woviesCreation',
    });

    await this.handleEvents({
      contract: this.tokenService.wovNftContract,
      eventName: 'Transfer',
    });
  }
}
