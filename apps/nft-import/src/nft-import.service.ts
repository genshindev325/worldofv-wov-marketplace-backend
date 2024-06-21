import { BlockchainSyncService } from '@app/blockchain-sync';
import { FileUploadService } from '@app/file-upload';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  BlockchainSyncPfpServiceClient,
  BLOCKCHAIN_SYNC_PFP_SERVICE_NAME,
} from '@generated/ts-proto/services/blockchain_sync_pfp';
import {
  BlockchainSyncStakeServiceClient,
  BLOCKCHAIN_SYNC_STAKE_SERVICE_NAME,
} from '@generated/ts-proto/services/blockchain_sync_stake';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
  UpsertTokenData,
} from '@generated/ts-proto/services/nft';
import {
  ImportCollectionArgs,
  ImportStakingContractArgs,
} from '@generated/ts-proto/services/nft_import';
import { FetcherConfig } from '@generated/ts-proto/types/collection';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  CollectionType,
  Prisma,
  Prisma as PrismaNft,
} from '@prisma/client/nft';
import PromisePool from '@supercharge/promise-pool/dist';
import { Queue } from 'bullmq';
import { BURN_ADDRESSES_TO_CHECK, ZERO_ADDRESS } from 'common/constants';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import { ThorifyContract } from 'thorify';
import { fromWei, toWei } from 'web3-utils';
import ImportTokenJobData from './smart-contract/import-token-job-data';
import { TokenFetcherService } from './smart-contract/token-fetcher.service';
import StakingSyncJobData from './staking-contract/staking-sync-job-data';

export interface GetTokenDataArgs {
  collectionId: string;
  smartContractAddress: string;
  tokenId: string;
  fetcherConfig: FetcherConfig;
  stakingContractAddress?: string;
}

@Injectable()
export class NftImportService implements OnModuleInit {
  private readonly logger = new Logger(NftImportService.name);

  private grpcCollection: CollectionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcBlockchainSyncStake: BlockchainSyncStakeServiceClient;
  private grpcBlockchainSyncPfp: BlockchainSyncPfpServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.BLOCKCHAIN_SYNC_STAKE)
    private readonly blockchainSyncStakeClient: ClientGrpc,

    @Inject(GrpcClientKind.BLOCKCHAIN_SYNC_PFP)
    private readonly blockchainSyncPfpClient: ClientGrpc,

    @InjectQueue('nft-import/smart-contract')
    private readonly smartContractQueue: Queue<ImportTokenJobData>,

    @InjectQueue('nft-import/staking-contract')
    private readonly stakingContractQueue: Queue<StakingSyncJobData>,

    private readonly fileUploadService: FileUploadService,
    private readonly contractService: ContractService,
    private readonly blockchainSyncService: BlockchainSyncService,
    private readonly tokenFetcherService: TokenFetcherService,
  ) {}

  onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcBlockchainSyncStake = this.blockchainSyncStakeClient.getService(
      BLOCKCHAIN_SYNC_STAKE_SERVICE_NAME,
    );
    this.grpcBlockchainSyncPfp = this.blockchainSyncPfpClient.getService(
      BLOCKCHAIN_SYNC_PFP_SERVICE_NAME,
    );
  }

  async getStakingGenerationRate(
    stakingContractAddress: string,
    tokenId: string,
  ) {
    const stakingContract = this.contractService.getContract(
      stakingContractAddress,
      'staking',
    );

    try {
      return await stakingContract.methods
        ._mapTokenDailyGenerationRates(tokenId)
        .call();
    } catch (error) {
      // `_mapTokenDailyGenerationRates` is not part of the standard staking ABI
      // so when the execution is reverted we know the contract does not
      // support variable generation rates.
      if (
        typeof error?.message === 'string' &&
        error.message.includes('VM executing failed: execution reverted')
      ) {
        return null;
      } else {
        throw error;
      }
    }
  }

  async getTokenIDs(smartContractAddress: string) {
    const contract = this.contractService.getContract(
      smartContractAddress,
      'pfp-standard',
    );

    const [mintedTokenIDs, burnedTokenIDs] = await Promise.all([
      // Minted
      contract
        .getPastEvents('Transfer', {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { from: ZERO_ADDRESS },
        })
        .then((events) => events.map((event) => event.returnValues.tokenId)),

      // Burned
      contract
        .getPastEvents('Transfer', {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { to: BURN_ADDRESSES_TO_CHECK },
        })
        .then(
          (events) =>
            new Set(events.map((event) => event.returnValues.tokenId)),
        ),
    ]);

    const filteredTokenIDs = mintedTokenIDs
      .filter((tokenId) => !burnedTokenIDs.has(tokenId))
      .sort((a, b) => Number(a) - Number(b));

    this.logger.log(
      `[${this.getTokenIDs.name}] Minted token IDs: ${mintedTokenIDs.length}`,
    );
    this.logger.log(
      `[${this.getTokenIDs.name}] Burned token IDs: ${burnedTokenIDs.size}`,
    );
    this.logger.log(
      `[${this.getTokenIDs.name}] Filtered token IDs: ${filteredTokenIDs.length}`,
    );

    return filteredTokenIDs;
  }

  async createCollection(data: ImportCollectionArgs) {
    const collection = await lastValueFrom(
      this.grpcCollection
        .findUnique(
          encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
            where: { smartContractAddress: data.smartContractAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of(null);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    // Upload the images if provided
    const thumbnailImageUrl = data.thumbnailImageUrl
      ? await this.fileUploadService.uploadUrl({
          url: data.thumbnailImageUrl,
          path: 'image/collection/thumbnail',
          previousUrl: collection?.thumbnailImageUrl,
        })
      : undefined;

    const bannerImageUrl = data.bannerImageUrl
      ? await this.fileUploadService.uploadUrl({
          url: data.bannerImageUrl,
          path: 'image/collection/banner',
          previousUrl: collection?.bannerImageUrl,
        })
      : undefined;

    return await lastValueFrom(
      this.grpcCollection.upsert({
        where: { smartContractAddress: data.smartContractAddress },
        data: {
          ...collection,
          ...data,
          thumbnailImageUrl,
          bannerImageUrl,
          stakingEndDate: undefined,
          type: CollectionType.EXTERNAL,
          importedAt: new Date().toISOString(),
        },
      }),
    );
  }

  async getRoyalty(
    contract: ThorifyContract,
    tokenId: string,
    fallbackValue?: string | number,
  ) {
    try {
      const royaltyInfo = await contract.methods
        .royaltyInfo(tokenId, toWei('100', 'ether'))
        .call();

      if (royaltyInfo.royaltyAmount) {
        return parseFloat(fromWei(royaltyInfo.royaltyAmount, 'ether'));
      }
    } catch {
      // Fallback to import defined royalty value
      if (fallbackValue) {
        return _.isString(fallbackValue)
          ? parseFloat(fallbackValue)
          : fallbackValue;
      }
    }

    return 0;
  }

  async getMintedAt(contract: ThorifyContract, tokenId: string) {
    return await contract
      .getPastEvents('Transfer', {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { tokenId, from: ZERO_ADDRESS },
      })
      .then((events) => events[0].blockNumber);
  }

  async pushStakingContract(
    collectionId: string,
    stakingContractAddress: string,
  ) {
    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          select: { stakingContractAddresses: true },
          where: { collectionId },
        }),
      ),
    );

    const stakingContractAddresses = [stakingContractAddress];

    for (const address of collection.stakingContractAddresses ?? []) {
      if (isSameAddress(address, stakingContractAddress)) {
        this.logger.log(
          `[${this.pushStakingContract.name}] Staking contract ${address} is already present, setting as active contract.`,
        );
      } else {
        stakingContractAddresses.push(address);
      }
    }

    await lastValueFrom(
      this.grpcCollection.update(
        encodeSerializedJson<PrismaNft.CollectionUpdateArgs>({
          where: { collectionId },
          data: { stakingContractAddresses },
        }),
      ),
    );

    await lastValueFrom(
      this.grpcBlockchainSyncStake.pushStakingContract({
        stakingContractAddress,
      }),
    );

    return true;
  }

  async getTokenData({
    collectionId,
    smartContractAddress,
    tokenId,
    fetcherConfig,
    stakingContractAddress,
  }: GetTokenDataArgs): Promise<UpsertTokenData> {
    const metadata = await this.tokenFetcherService.fetchMetadata(
      smartContractAddress,
      tokenId,
      fetcherConfig,
    );

    const contract = this.contractService.getContract(
      smartContractAddress,
      'pfp-standard',
    );

    const [royalty, mintedAt, ownerAddress, stakingEarnings] =
      await Promise.all([
        this.getRoyalty(contract, tokenId),
        this.getMintedAt(contract, tokenId),
        this.blockchainSyncService.getOwner(contract, tokenId),
        stakingContractAddress
          ? this.getStakingGenerationRate(stakingContractAddress, tokenId)
          : null,
      ]);

    return {
      ...metadata,
      attributes: metadata.attributes,
      creatorAddress: smartContractAddress,
      score: metadata.score,
      tokenId,
      smartContractAddress,
      collectionId,
      editionsCount: 1,
      royalty,
      categories: ['PFP'],
      mintedAt,
      stakingEarnings,
      editions: [
        {
          tokenId,
          smartContractAddress,
          editionId: tokenId,
          ownerAddress,
          updatedAt: mintedAt,
        },
      ],
    };
  }

  async importToken(smartContractAddress: string, tokenId: string) {
    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          where: { smartContractAddress },
        }),
      ),
    );

    const data = await this.getTokenData({
      smartContractAddress,
      tokenId,
      stakingContractAddress: collection.stakingContractAddresses?.[0],
      collectionId: collection.collectionId,
      fetcherConfig: collection.fetcherConfig || {},
    });

    return lastValueFrom(
      this.grpcToken.upsert({ where: { smartContractAddress, tokenId }, data }),
    );
  }

  async importStakingContract({
    collectionId,
    stakingContractAddress,
  }: ImportStakingContractArgs) {
    const done = await this.pushStakingContract(
      collectionId,
      stakingContractAddress,
    );

    const { tokens } = await lastValueFrom(
      this.grpcToken.findMany(
        encodeSerializedJson<Prisma.TokenFindManyArgs>({
          where: { collectionId },
        }),
      ),
    );

    const jobs = tokens.map(({ smartContractAddress, tokenId }) => ({
      name: 'STAKING_SYNC',
      data: {
        stakingContractAddress,
        smartContractAddress,
        tokenId,
      },
    }));

    await this.stakingContractQueue.addBulk(jobs);

    this.logger.log(
      `[${stakingContractAddress}] Import started. ${jobs.length} jobs queued.`,
    );

    return done;
  }

  async importCollection(args: ImportCollectionArgs) {
    // Create the collection
    const collection = await this.createCollection(args);

    this.logger.log(
      `[${collection.smartContractAddress}] Collection created with ID "${collection.collectionId}"`,
    );

    // Get token IDs from the smart contract
    const tokenIDs = await this.getTokenIDs(collection.smartContractAddress);

    this.logger.log(
      `[${collection.smartContractAddress}] Trying to add ${tokenIDs.length} jobs to queue`,
    );

    await this.smartContractQueue.addBulk(
      tokenIDs.map((tokenId) => ({
        name: 'IMPORT_TOKEN',
        data: {
          tokenId,
          smartContractAddress: collection.smartContractAddress,
          creatorAddress: args.creatorAddress,
          collectionId: collection.collectionId,
          stakingContractAddress: collection.stakingContractAddresses?.[0],
          fetcherConfig: args.fetcherConfig,
        },
      })),
    );

    this.logger.log(
      `[${collection.smartContractAddress}] Import started for "${collection.name}".`,
    );

    await lastValueFrom(
      this.grpcBlockchainSyncPfp
        .pushSmartContract({
          smartContractAddress: collection.smartContractAddress,
        })
        .pipe(
          catchError((err) => {
            this.logger.error(
              `[${collection.smartContractAddress}] Couldn't push the contract address to PFP Sync Service`,
              err,
            );

            return of(null);
          }),
        ),
    );

    return collection;
  }

  async deleteCollection(smartContractAddress: string) {
    const collection = await lastValueFrom(
      this.grpcCollection
        .findUnique(
          encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
            where: { smartContractAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of(null);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    if (!collection) {
      this.logger.warn(
        `[${this.deleteCollection.name}] Collection '${smartContractAddress}' not found, skipping deletion.`,
      );
      return false;
    }

    await lastValueFrom(
      this.grpcBlockchainSyncPfp
        .removeSmartContract({ smartContractAddress })
        .pipe(
          catchError(() => {
            this.logger.error(
              `[${this.deleteCollection.name}] Failed to unsubscribe contract ${smartContractAddress} from blockchain sync.`,
            );
            return of(null);
          }),
        ),
    );

    if (collection.stakingContractAddresses) {
      for (const stakingContractAddress of collection.stakingContractAddresses) {
        await lastValueFrom(
          this.grpcBlockchainSyncStake
            .removeStakingContract({ stakingContractAddress })
            .pipe(
              catchError(() => {
                this.logger.error(
                  `[${this.deleteCollection.name}] Failed to unsubscribe contract ${stakingContractAddress} from blockchain sync.`,
                );
                return of(null);
              }),
            ),
        );
      }
    }

    const { tokens } = await lastValueFrom(
      this.grpcToken.findMany(
        encodeSerializedJson<PrismaNft.TokenFindManyArgs>({
          where: { smartContractAddress },
        }),
      ),
    );

    // Deleting the tokens one at a time is inefficent AF but it makes sure all
    // assets are deleted and the MP database is up to date. Since this
    // operation is only performed once in a while I don't think it's worth
    // optimizing.
    await new PromisePool(tokens)
      .withConcurrency(20)
      .process(async ({ tokenId }) => {
        await lastValueFrom(
          this.grpcToken.delete({ tokenId, smartContractAddress }),
        );
      });

    this.logger.log(
      `[${this.deleteCollection.name}] Removed ${tokens.length} tokens for collection '${smartContractAddress}'.`,
    );

    await lastValueFrom(
      this.grpcCollection.delete(
        encodeSerializedJson<PrismaNft.CollectionDeleteArgs>({
          where: { smartContractAddress },
        }),
      ),
    );

    this.logger.log(
      `[${this.deleteCollection.name}] Removed collection '${smartContractAddress}'.`,
    );

    return true;
  }
}
