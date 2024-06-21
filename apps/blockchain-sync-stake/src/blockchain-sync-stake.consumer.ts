import { BlockchainSyncBaseConsumer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  EditionServiceClient,
  EDITION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client/nft';
import { Job } from 'bullmq';
import { BURN_ADDRESSES_TO_CHECK } from 'common/constants';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import Web3 from 'web3';
import { EventData } from 'web3-eth-contract';

@Processor('blockchain/stake', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.STAKE_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class StakeConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(StakeConsumer.name);

  private grpcEdition: EditionServiceClient;
  private grpcCollection: CollectionServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    private readonly contractService: ContractService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'Ticket':
      case 'CloseTicket':
        return this.onStakeEvent(job);
      case 'RewardAdded':
        return this.onStakingPoolStart(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onStakeEvent(job: Job<EventData>) {
    const { tokenId } = job.data.returnValues;
    const stakingContractAddress = job.data.address;

    const stakingContract = this.contractService.getContract(
      stakingContractAddress,
      'staking',
    );

    const details = await stakingContract.methods.tokenDetail(tokenId).call();

    const smartContractAddress = await stakingContract.methods
      .pfpCollection()
      .call();

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

    const burnEvents = await nftContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { to: BURN_ADDRESSES_TO_CHECK, tokenId },
    });

    if (burnEvents.length) {
      this.logger.log(
        `Skipping stake event because token #${tokenId} has not been minted or has been burned`,
      );
      return;
    }

    // Multiple edition tokens are not supported for staking so we can
    // get the edition id from the token id.
    const editionId = isSameAddress(smartContractAddress, wovNftAddress)
      ? tokenId.replace(/0$/, '1')
      : tokenId;

    const edition = await lastValueFrom(
      this.grpcEdition.findOne(
        encodeSerializedJson<Prisma.EditionFindUniqueArgs>({
          select: {
            stakingContractAddress: true,
          },
          where: {
            editionId_smartContractAddress: {
              smartContractAddress,
              editionId,
            },
          },
        }),
      ),
    );

    if (
      edition.stakingContractAddress &&
      !isSameAddress(stakingContractAddress, edition.stakingContractAddress) &&
      details.isExit
    ) {
      this.logger.log(
        `Skipping stake event because token #${tokenId} is currently staked on another contract.`,
      );
      return;
    }

    await lastValueFrom(
      this.grpcEdition.update(
        encodeSerializedJson<Prisma.EditionUpdateArgs>({
          where: {
            editionId_smartContractAddress: {
              smartContractAddress,
              editionId,
            },
          },
          data: {
            stakingContractAddress: !details.isExit
              ? stakingContractAddress
              : null,
          },
        }),
      ),
    );
  }

  async onStakingPoolStart(job: Job<EventData>) {
    const stakingContractAddress = job.data.address;

    const stakingContract = this.contractService.getContract(
      stakingContractAddress,
      'staking',
    );

    const checksumAddress = Web3.utils.toChecksumAddress(
      stakingContractAddress,
    );
    const lowercaseAddress = stakingContractAddress.toLowerCase();

    const collection = await lastValueFrom(
      this.grpcCollection.findFirst(
        encodeSerializedJson<Prisma.CollectionFindFirstArgs>({
          where: {
            stakingContractAddresses: {
              hasSome: [checksumAddress, lowercaseAddress],
            },
          },
        }),
      ),
    );

    // Fetch latest data from blockchain
    // periodFinish === 0       -> not started
    // 0 < periodFinish < now() -> finished
    // periodFinish > now()     -> ongoing
    const periodFinish = await stakingContract.methods.periodFinish().call();

    await lastValueFrom(
      this.grpcCollection.update(
        encodeSerializedJson<Prisma.CollectionUpdateArgs>({
          where: {
            collectionId: collection.collectionId,
          },
          data: {
            stakingEndDate: new Date(periodFinish * 1000).toISOString(),
          },
        }),
      ),
    );
  }
}
