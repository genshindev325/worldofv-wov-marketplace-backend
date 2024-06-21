import { REDIS_PUB_SUB } from '@app/redis-client';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainEventStatus, PrismaClient } from '@prisma/client/blockchain';
import { Job } from 'bullmq';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { BlockchainSyncBaseWorker } from './blockchain-sync-base.worker';

export abstract class BlockchainSyncBaseConsumer extends BlockchainSyncBaseWorker {
  protected readonly logger = new Logger(BlockchainSyncBaseConsumer.name);

  @Inject(REDIS_PUB_SUB) private readonly pubSub: RedisPubSub;
  @Inject(PrismaClient) private readonly prisma: PrismaClient;
  @Inject(ConfigService) protected readonly configService: ConfigService;

  private async saveEvent(jobId: string, status: BlockchainEventStatus) {
    return this.prisma.blockchainEvent.update({
      where: { jobId },
      data: { status },
    });
  }

  @OnWorkerEvent('failed')
  protected async onJobFail(job: Job, error: Error) {
    if (job.attemptsMade >= job.opts.attempts) {
      this.logger.error(`[${job.id}] Job failed with`, error);
      await this.saveEvent(job.id, BlockchainEventStatus.FAILED);
    }
  }

  @OnWorkerEvent('completed')
  protected async onJobComplete(job: Job) {
    const blockchainEvent = await this.saveEvent(
      job.id,
      BlockchainEventStatus.COMPLETED,
    );

    const cacheTTL = this.configService.getOrThrow('GATEWAY_SYNC_CACHE_TTL');

    // Wait for the cache in front of the gateway endpoints to expire before
    // notifying the client of the update.
    await new Promise((resolve) => setTimeout(resolve, cacheTTL * 1000));

    await this.pubSub.publish('EventProcessed', blockchainEvent);

    this.logger.log(`[${job.id}] Job completed`);
  }
}
