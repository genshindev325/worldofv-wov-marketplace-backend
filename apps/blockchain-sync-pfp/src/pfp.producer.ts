import { BlockchainSyncBaseProducer } from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  BlockchainSyncPfpServiceController,
  BlockchainSyncPfpServiceControllerMethods,
  FindSmartContractArgs,
} from '@generated/ts-proto/services/blockchain_sync_pfp';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { Collection } from '@generated/ts-proto/types/collection';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { CollectionType, Prisma as PrismaNft } from '@prisma/client/nft';
import { Queue } from 'bullmq';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom, map, retry, timer } from 'rxjs';

@Controller()
@BlockchainSyncPfpServiceControllerMethods()
export class PfpProducer
  extends BlockchainSyncBaseProducer
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    BlockchainSyncPfpServiceController
{
  protected readonly logger = new Logger(PfpProducer.name);

  private grpcCollection: CollectionServiceClient;

  constructor(
    @InjectQueue('blockchain/pfp') protected readonly queue: Queue,
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

  private async subscribe({
    smartContractAddress,
    cooldownContractAddress,
  }: Collection) {
    const contract = this.contractService.getContract(
      smartContractAddress,
      cooldownContractAddress ? 'pfp-burn-mint' : 'pfp-standard',
    );

    await this.handleEvents({ contract, eventName: 'Transfer' });

    if (cooldownContractAddress) {
      await this.handleEvents({ contract, eventName: 'cooldown' });
    }
  }

  private async loadCollections() {
    const collections = await lastValueFrom(
      this.grpcCollection
        .findMany(
          encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
            where: {
              type: CollectionType.EXTERNAL,
            },
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

    for (const collection of collections) {
      await this.subscribe(collection);
    }
  }

  async pushSmartContract({ smartContractAddress }: FindSmartContractArgs) {
    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          where: { smartContractAddress },
        }),
      ),
    );

    await this.subscribe(collection);
  }

  removeSmartContract({ smartContractAddress }: FindSmartContractArgs) {
    this.unsubscribe(smartContractAddress, 'Transfer');
    this.unsubscribe(smartContractAddress, 'cooldown');
  }
}
