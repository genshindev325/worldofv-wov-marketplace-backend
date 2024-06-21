import { BlockchainSyncBaseConsumer } from '@app/blockchain-sync';
import { Processor } from '@nestjs/bullmq';
import { Logger, NotImplementedException } from '@nestjs/common';
import { Job } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { UserService } from './user.service';

@Processor('blockchain/user', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.USER_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class UserConsumer extends BlockchainSyncBaseConsumer {
  protected readonly logger = new Logger(UserConsumer.name);

  constructor(private readonly userService: UserService) {
    super();
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'accountRegister':
        return await this.onAccountRegister(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onAccountRegister({ data }: Job) {
    const address = data.returnValues.account;
    const accountInfo = await this.userService.fetchAccountInfo(address);
    return await lastValueFrom(this.userService.grpcUser.upsert(accountInfo));
  }
}
