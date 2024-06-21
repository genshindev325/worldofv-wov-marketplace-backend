import {
  BlockchainSyncBaseWorker,
  BlockchainSyncService,
} from '@app/blockchain-sync';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import { ContractService } from '@blockchain/contract';
import { HttpService } from '@nestjs/axios';
import { Processor } from '@nestjs/bullmq';
import { Inject, Logger, NotImplementedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/nft';
import { Job } from 'bullmq';
import { ZERO_ADDRESS } from 'common/constants';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import { isSameAddress } from 'common/is-same-address.helper';
import { catchError, lastValueFrom, of } from 'rxjs';
import { TokenService } from '../token/token.service';

@Processor('nft/collection/resync', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.COLLECTION_RESYNC_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class CollectionConsumer extends BlockchainSyncBaseWorker {
  protected readonly logger = new Logger(CollectionConsumer.name);

  constructor(
    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceClient: ClientProxy,

    private readonly http: HttpService,
    private readonly prisma: PrismaClient,
    private readonly contractService: ContractService,
    private readonly blockchainSyncService: BlockchainSyncService,
    private readonly tokenService: TokenService,
  ) {
    super();
  }

  async handleJob(job: Job): Promise<any> {
    switch (job.name) {
      case 'resyncOwner':
        return await this.onResyncOwner(job);
      case 'resyncStaking':
        return await this.onResyncStaking(job);
      case 'resyncAssets':
        return await this.onResyncAssets(job);
      default:
        throw new NotImplementedException(`No handler found for "${job.name}"`);
    }
  }

  async onResyncOwner(job: Job) {
    const contract = this.contractService.getContract(
      job.data.smartContractAddress,
      'pfp-standard',
    );

    const ownerAddress = await this.blockchainSyncService.getOwner(
      contract,
      job.data.editionId,
    );

    const edition = await this.prisma.edition.update({
      where: { editionId_smartContractAddress: job.data },
      data: { ownerAddress },
    });

    await lastValueFrom(
      this.marketplaceClient.send('UpdateToken', edition).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.onResyncOwner.name}] Error while updating marketplace via Redis`,
            err,
          );

          return of(null);
        }),
      ),
    );
  }

  async onResyncStaking(job: Job) {
    const { editionId, smartContractAddress, stakingContractAddresses } =
      job.data;

    let stakingContractAddress = null;

    for (const currentStakingAddress of stakingContractAddresses) {
      const stakingContract = this.contractService.getContract(
        currentStakingAddress,
        'staking',
      );

      const tokenId = getTokenIdFromEditionId(smartContractAddress, editionId);
      const details = await stakingContract.methods.tokenDetail(tokenId).call();

      if (
        !isSameAddress(details.ticketOwner, ZERO_ADDRESS) &&
        !details.isExit
      ) {
        stakingContractAddress = currentStakingAddress;
        break;
      }
    }

    const edition = await this.prisma.edition.update({
      where: {
        editionId_smartContractAddress: { editionId, smartContractAddress },
      },
      data: { stakingContractAddress },
    });

    await lastValueFrom(
      this.marketplaceClient.send('UpdateToken', edition).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.onResyncStaking.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );
  }

  async onResyncAssets(job: Job) {
    await this.tokenService.resyncAssets(
      job.data.smartContractAddress,
      job.data.tokenId,
    );
  }
}
