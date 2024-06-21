import {
  BlockchainSyncBaseWorker,
  BlockchainSyncService,
} from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Processor } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client/nft';
import { Job } from 'bullmq';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import { NftImportService } from '../nft-import.service';
import StakingSyncJobData from './staking-sync-job-data';

@Processor('nft-import/staking-contract', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.NFT_IMPORT_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class StakingContractConsumer
  extends BlockchainSyncBaseWorker
  implements OnModuleInit
{
  protected readonly logger = new Logger(StakingContractConsumer.name);

  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,
    private readonly contractService: ContractService,
    private readonly configService: ConfigService,
    private readonly blockchainSyncService: BlockchainSyncService,
    private readonly nftImportService: NftImportService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
  }

  async handleJob(job: Job<StakingSyncJobData>): Promise<any> {
    const { smartContractAddress, stakingContractAddress, tokenId } = job.data;

    const stakingEarnings =
      await this.nftImportService.getStakingGenerationRate(
        stakingContractAddress,
        tokenId,
      );

    try {
      await lastValueFrom(
        this.grpcToken.update(
          encodeSerializedJson<Prisma.TokenUpdateArgs>({
            where: {
              tokenId_smartContractAddress: { smartContractAddress, tokenId },
            },
            data: { stakingEarnings },
          }),
        ),
      );
    } catch (error) {
      if (error?.code === GrpcStatus.NOT_FOUND) {
        this.logger.warn(
          `Token '${smartContractAddress}/${tokenId}' not found in the database, skipping.`,
        );
        return;
      } else {
        throw error;
      }
    }

    const wovNftAddress = this.configService.getOrThrow(
      'WOV_MARKETPLACE_TOKEN_ADDRESS',
    );

    const abi = isSameAddress(smartContractAddress, wovNftAddress)
      ? 'wov-nft'
      : 'pfp-standard';

    const nftContract = this.contractService.getContract(
      smartContractAddress,
      abi,
    );

    // Multiple edition tokens are not supported for staking so we can
    // get the edition id from the token id.
    const editionId = isSameAddress(smartContractAddress, wovNftAddress)
      ? tokenId.replace(/0$/, '1')
      : tokenId;

    // Also resync the owner just in case a token is staked.
    const ownerAddress = await this.blockchainSyncService.getOwner(
      nftContract,
      editionId,
    );

    await lastValueFrom(
      this.grpcEdition.update(
        encodeSerializedJson<Prisma.EditionUpdateArgs>({
          where: {
            editionId_smartContractAddress: {
              smartContractAddress,
              editionId,
            },
          },
          data: { ownerAddress },
        }),
      ),
    );
  }
}
