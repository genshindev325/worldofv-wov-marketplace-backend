import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaSale, SaleStatus } from '@prisma/client/sale';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import { ThorifyContract } from 'thorify';

@Injectable()
export class BlockchainSyncService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainSyncService.name);

  private saleContract: ThorifyContract;
  private auctionContract: ThorifyContract;

  private grpcCollection: CollectionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcSale: SaleServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    @Inject(GrpcClientKind.SALE) private readonly saleClient: ClientGrpc,
    private readonly contractService: ContractService,
  ) {}

  async onModuleInit() {
    this.saleContract = this.contractService.getContract(
      process.env.WOV_SALE_V2_ADDRESS,
      'wov-sale-v2',
    );

    this.auctionContract = this.contractService.getContract(
      process.env.WOV_BID_AUCTION_ADDRESS,
      'wov-auction',
    );

    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
  }

  async getOwner(contract: ThorifyContract, editionId: string) {
    const owner = await contract.methods.ownerOf(editionId).call();

    // Get the owner from the sale contract
    if (isSameAddress(owner, this.saleContract.options.address)) {
      return await this.saleContract
        .getPastEvents('listing', {
          fromBlock: 0,
          toBlock: 'latest',
          filter: {
            tokenId: editionId,
            nft: contract.options.address,
          },
        })
        .then((data) =>
          data.sort(
            (a, b) =>
              (b.blockNumber || b.meta.blockNumber) -
              (a.blockNumber || a.meta.blockNumber),
          ),
        )
        .then((events) =>
          events.length ? events[0].returnValues?.seller : null,
        );
    }

    // Get the owner from the auction contract
    if (isSameAddress(owner, this.auctionContract.options.address)) {
      return await this.auctionContract
        .getPastEvents('newAuction', {
          fromBlock: 0,
          toBlock: 'latest',
          filter: {
            tokenId: editionId,
            nft: contract.options.address,
          },
        })
        .then((data) =>
          data.sort(
            (a, b) =>
              (b.blockNumber || b.meta.blockNumber) -
              (a.blockNumber || a.meta.blockNumber),
          ),
        )
        .then((events) =>
          events.length ? events[0].returnValues?.seller : null,
        );
    }

    const tokenId = getTokenIdFromEditionId(
      contract.options.address,
      editionId,
    );

    const stakingAddresses = await this.fetchStakingContractAddresses(
      contract.options.address,
      tokenId,
    );

    // Get the owner from the staking contract
    const stakingAddress = stakingAddresses.find((address) =>
      isSameAddress(owner, address),
    );

    if (stakingAddress) {
      const stakingContract = this.contractService.getContract(
        stakingAddress,
        'staking',
      );

      const details = await stakingContract.methods.tokenDetail(tokenId).call();

      if (details?.ticketOwner) {
        return details.ticketOwner;
      }
    }

    // Return the owner returned from the contract
    return owner;
  }

  private async fetchStakingContractAddresses(
    smartContractAddress: string,
    tokenId: string,
  ): Promise<string[]> {
    const collectionId = await lastValueFrom(
      this.grpcToken
        .findUnique(
          encodeSerializedJson<PrismaNft.TokenFindUniqueArgs>({
            where: {
              tokenId_smartContractAddress: { smartContractAddress, tokenId },
            },
          }),
        )
        .pipe(
          map((token) => token.collectionId),
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of(null);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    if (!collectionId) {
      return [];
    }

    return await lastValueFrom(
      this.grpcCollection
        .findUnique(
          encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
            where: { collectionId },
            select: { stakingContractAddresses: true },
          }),
        )
        .pipe(
          map((collection) => collection.stakingContractAddresses ?? []),
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of([]);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );
  }

  async getLastTransfer(
    smartContractAddress: string,
    editionId: string,
    ownerAddress: string,
    blacklistAddresses: string[] = [],
  ) {
    const abiKind = isSameAddress(
      smartContractAddress,
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
    )
      ? 'wov-nft'
      : 'pfp-standard';

    const nftContract = this.contractService.getContract(
      smartContractAddress,
      abiKind,
    );

    const saleTransfers = await nftContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: {
        tokenId: editionId,
        from: ownerAddress,
        to: [
          process.env.WOV_SALE_V2_ADDRESS,
          process.env.WOV_BID_AUCTION_ADDRESS,
        ],
      },
    });

    // This is the latest event where a token was transferred TO the
    // sale/auction contract.
    const latestSaleTransfer = _.maxBy(
      saleTransfers,
      (e: any) => e.blockNumber || e.meta.blockNumber,
    );

    // If the token was transferred TO the sale/auction contract and it goes
    // back to the same owner, the transfers FROM the sale/auction contract
    // should be ignored.
    if (isSameAddress(latestSaleTransfer?.returnValues?.from, ownerAddress)) {
      blacklistAddresses = blacklistAddresses.concat([
        process.env.WOV_SALE_V2_ADDRESS,
        process.env.WOV_BID_AUCTION_ADDRESS,
      ]);
    }

    const transferEvents = await nftContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { tokenId: editionId, to: ownerAddress },
    });

    const validEvents = transferEvents?.filter((event) => {
      return blacklistAddresses.every(
        (a) => !isSameAddress(a, event.returnValues.from),
      );
    });

    const latestEvent = _.maxBy(
      validEvents || [],
      (e: any) => e.blockNumber || e.meta.blockNumber,
    );

    return latestEvent;
  }

  async getLastTransferBlockNumber(
    smartContractAddress: string,
    editionId: string,
    ownerAddress: string,
    blacklistAddresses: string[] = [],
  ) {
    const latestEvent = await this.getLastTransfer(
      smartContractAddress,
      editionId,
      ownerAddress,
      blacklistAddresses,
    );

    return latestEvent?.blockNumber || latestEvent?.meta?.blockNumber;
  }

  /**
   * When using non custodial listing the sale is to be considered cancelled
   * if the token was transferred during the listing period, even in case it
   * gets transferred back to the original owner.
   */
  async cancelSaleIfInvalid(
    smartContractAddress: string,
    editionId: string,
    lastTransferredAt: number,
  ) {
    const latestSale = await lastValueFrom(
      this.grpcSale
        .findFirst(
          encodeSerializedJson<PrismaSale.SaleFindFirstArgs>({
            where: {
              status: SaleStatus.LISTED,
              smartContractAddress,
              editionId,
              saleId: { startsWith: '4' }, // We are only interested in V3 sales.
              startingTime: { lt: new Date(lastTransferredAt * 1000) },
            },
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

    if (!latestSale) return;

    this.logger.log(
      `Force cancelling sale '${latestSale.saleId}' because the token has been transferred.`,
    );

    latestSale.status = SaleStatus.CANCELLED;

    await lastValueFrom(
      this.grpcSale.upsert(
        encodeSerializedJson<PrismaSale.SaleUpsertArgs>({
          where: { saleId: latestSale.saleId },
          create: latestSale as PrismaSale.SaleCreateInput,
          update: latestSale as PrismaSale.SaleUpdateInput,
        }),
      ),
    );
  }
}
