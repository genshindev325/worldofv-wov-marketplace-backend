import {
  BlockchainSyncBaseConsumer,
  BlockchainSyncService,
} from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  NftImportServiceClient,
  NFT_IMPORT_SERVICE_NAME,
} from '@generated/ts-proto/services/nft_import';
import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Job } from 'bullmq';
import { BURN_ADDRESSES_TO_CHECK } from 'common/constants';
import isBurnAddress from 'common/is-burn-address';
import { encodeSerializedJson } from 'common/serialized-json';
import { isEmpty } from 'lodash';
import { lastValueFrom, map } from 'rxjs';
import { EventData } from 'web3-eth-contract';

@Processor('blockchain/pfp', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.PFP_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class PfpConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(PfpConsumer.name);

  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcImport: NftImportServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.NFT_IMPORT)
    private readonly nftImportClient: ClientGrpc,

    private readonly contractService: ContractService,

    private readonly blockchainSyncService: BlockchainSyncService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcImport = this.nftImportClient.getService(NFT_IMPORT_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'Transfer':
        return await this.onTransfer(job);
      case 'cooldown':
        return await this.onCooldown(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onTransfer(job: Job<EventData>) {
    const tokenId = job.data.returnValues.tokenId;
    const smartContractAddress = job.data.address;

    if (isBurnAddress(job.data.returnValues.to)) {
      this.logger.log(
        `[${job.id}] Transfer event is a burn event to address(0)`,
      );

      return await lastValueFrom(
        this.grpcToken.delete({ tokenId, smartContractAddress }),
      );
    }

    const contract = this.contractService.getContract(
      smartContractAddress,
      'pfp-standard',
    );

    const tokenExists = await lastValueFrom(
      this.grpcToken
        .exists({ tokenId, smartContractAddress })
        .pipe(map(({ value }) => value)),
    );

    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          select: {
            collectionId: true,
            stakingContractAddresses: true,
            fetcherConfig: true,
          },
          where: { smartContractAddress },
        }),
      ),
    );

    if (!tokenExists) {
      this.logger.log(
        `[${job.id}] Token #${tokenId} will be inserted in the database.`,
      );

      const burnEvents = await contract.getPastEvents('Transfer', {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { to: BURN_ADDRESSES_TO_CHECK, tokenId },
      });

      if (burnEvents.length) {
        this.logger.log(
          `Completion of the transfer event before execution because token #${tokenId} has not been minted or has been burned`,
        );
        return;
      }

      if (isEmpty(collection.fetcherConfig)) {
        this.logger.warn(
          `[${job.id}] Fetcher configuration not found, skipping`,
        );
        return;
      }

      await lastValueFrom(
        this.grpcImport.importToken({ smartContractAddress, tokenId }),
      );
    }

    // If the token exists, get the owner of the edition and update it
    let ownerAddress;

    try {
      ownerAddress = await this.blockchainSyncService.getOwner(
        contract,
        tokenId,
      );
    } catch (err) {
      const isNotMinted =
        err.message.includes('Token not minted') ||
        err.message.includes('VM reverted: EnumerableMap: nonexistent key');

      if (isNotMinted) {
        return await job.log(
          `Completion of the transfer event before execution because token #${tokenId} has not been minted or has been burned`,
        );
      }

      throw err;
    }

    const lastTransfer = await this.blockchainSyncService.getLastTransfer(
      smartContractAddress,
      tokenId,
      ownerAddress,
      collection.stakingContractAddresses,
    );

    if (lastTransfer) {
      await this.blockchainSyncService.cancelSaleIfInvalid(
        smartContractAddress,
        tokenId,
        lastTransfer.meta.blockTimestamp,
      );
    }

    return await lastValueFrom(
      this.grpcEdition.upsert(
        encodeSerializedJson<PrismaNft.EditionUpsertArgs>({
          where: {
            editionId_smartContractAddress: {
              editionId: tokenId,
              smartContractAddress,
            },
          },
          create: {
            tokenId,
            editionId: tokenId,
            smartContractAddress,
            ownerAddress,
            updatedAt: lastTransfer?.meta?.blockNumber,
          },
          update: {
            ownerAddress,
            updatedAt: lastTransfer?.meta?.blockNumber,
          },
        }),
      ),
    );
  }

  async onCooldown(job: Job<EventData>) {
    const editionId = job.data.returnValues.tokenId;
    const smartContractAddress = job.data.address;

    const contract = this.contractService.getContract(
      smartContractAddress,
      'pfp-burn-mint',
    );

    // Fetch latest data from blockchain
    const cooldownEnd = await contract.methods
      .cooldownMapping(editionId)
      .call();

    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          where: { smartContractAddress },
        }),
      ),
    );

    return await lastValueFrom(
      this.grpcEdition.update(
        encodeSerializedJson<PrismaNft.EditionUpdateArgs>({
          where: {
            editionId_smartContractAddress: {
              editionId,
              smartContractAddress: collection.cooldownContractAddress,
            },
          },
          data: { cooldownEnd: parseInt(cooldownEnd) },
        }),
      ),
    );
  }
}
