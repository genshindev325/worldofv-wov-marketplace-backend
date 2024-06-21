import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export abstract class BlockchainSyncBaseWorker extends WorkerHost {
  protected readonly logger = new Logger(BlockchainSyncBaseWorker.name);
  protected readonly timeout =
    Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000;

  /**
   * This method will be called by the internal "process" method
   * that will handle manually the timeout option
   **/
  abstract handleJob(job: Job): Promise<any>;

  public async process(job: Job): Promise<any> {
    const timeout = new Promise((resolve, reject) => {
      const timeoutSecs = this.timeout / 1000;
      const reason = `Job ${job.id} timed out after ${timeoutSecs} seconds`;
      setTimeout(() => reject(new Error(reason)), this.timeout);
    });

    try {
      return await Promise.race([this.handleJob(job), timeout]);
    } catch (error) {
      this.logger.error(`Error while processing job ${job.id}`, error);
      throw error;
    }
  }
}
