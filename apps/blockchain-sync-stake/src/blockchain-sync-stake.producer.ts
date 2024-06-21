import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  BlockchainSyncStakeServiceController,
  BlockchainSyncStakeServiceControllerMethods,
  FindStakingContractArgs,
} from '@generated/ts-proto/services/blockchain_sync_stake';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client/nft';
import { Queue } from 'bullmq';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom, map, retry, timer } from 'rxjs';

@Controller()
@BlockchainSyncStakeServiceControllerMethods()
export class StakeProducer
  extends BlockchainSyncBaseProducer
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    BlockchainSyncStakeServiceController
{
  protected readonly logger = new Logger(StakeProducer.name);

  private grpcCollection: CollectionServiceClient;

  private static EVENT_NAMES = ['Ticket', 'CloseTicket', 'RewardAdded'];

  constructor(
    @InjectQueue('blockchain/stake') protected readonly queue: Queue,
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    private readonly contractService: ContractService,
  ) {
    super(queue);
  }

  async onModuleInit() {
    await super.onModuleInit();
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
  }

  async onApplicationBootstrap() {
    await this.loadCollections();
  }

  private async subscribe(stakingContractAddress: string) {
    const contract = this.contractService.getContract(
      stakingContractAddress,
      'staking',
    );

    for (const eventName of StakeProducer.EVENT_NAMES) {
      await this.handleEvents({ contract, eventName });
    }
  }

  private async loadCollections() {
    const collections = await lastValueFrom(
      this.grpcCollection
        .findMany(
          encodeSerializedJson<Prisma.CollectionFindManyArgs>({
            where: { stakingContractAddresses: { isEmpty: false } },
          }),
        )
        .pipe(
          map(({ collections }) => collections || []),
          // This is necessary because the collection service might not be
          // ready yet when all the containers are being updated.
          retry({
            count: 20,
            delay: (error, retryCount) => {
              this.logger.warn(
                `[${this.loadCollections.name}] Failed to load collections, retrying in ${retryCount}s`,
              );
              return timer(retryCount * 1000);
            },
          }),
        ),
    );

    for (const { stakingContractAddresses } of collections) {
      for (const stakingContractAddress of stakingContractAddresses || []) {
        await this.subscribe(stakingContractAddress);
      }
    }
  }

  async pushStakingContract({
    stakingContractAddress,
  }: FindStakingContractArgs) {
    await this.subscribe(stakingContractAddress);
  }

  removeStakingContract({ stakingContractAddress }: FindStakingContractArgs) {
    for (const eventName of StakeProducer.EVENT_NAMES) {
      this.unsubscribe(stakingContractAddress, eventName);
    }
  }
}
