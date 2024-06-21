import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { UserService } from './user.service';

@Injectable()
export class UserProducer
  extends BlockchainSyncBaseProducer
  implements OnApplicationBootstrap
{
  protected readonly logger = new Logger(UserProducer.name);

  constructor(
    @InjectQueue('blockchain/user') protected readonly queue: Queue,
    private readonly userService: UserService,
  ) {
    super(queue);
  }

  async onApplicationBootstrap() {
    await this.handleEvents({
      contract: this.userService.userContract,
      eventName: 'accountRegister',
    });
  }
}
