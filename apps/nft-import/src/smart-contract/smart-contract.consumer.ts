import { BlockchainSyncBaseWorker } from '@app/blockchain-sync';
import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NftImportService } from '../nft-import.service';
import ImportTokenJobData from './import-token-job-data';

@Processor('nft-import/smart-contract', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.NFT_IMPORT_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class SmartContractConsumer extends BlockchainSyncBaseWorker {
  protected readonly logger = new Logger(SmartContractConsumer.name);

  constructor(private readonly nftImportService: NftImportService) {
    super();
  }

  async handleJob(job: Job<ImportTokenJobData>) {
    await this.nftImportService.importToken(
      job.data.smartContractAddress,
      job.data.tokenId,
    );

    this.logger.log(
      `[${this.handleJob.name}] Import successful for '${job.data.smartContractAddress}/${job.data.tokenId}'`,
    );
  }
}
