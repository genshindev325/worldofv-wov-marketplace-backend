import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GetTokenActivityArgs } from '@generated/ts-proto/services/activity';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/blockchain';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import Web3 from 'web3';
import { ActivityService } from '../activity.service';

const knexPg = knex({ client: 'pg' });
const toChecksumAddress = Web3.utils.toChecksumAddress;

@Injectable()
export class TokenActivityService implements OnModuleInit {
  private static readonly WOV_CONTRACT_ADDRESSES = [
    process.env.WOV_BID_AUCTION_ADDRESS,
    process.env.WOV_SALE_V2_ADDRESS,
  ];

  private grpcCollection: CollectionServiceClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly activityService: ActivityService,

    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
  }

  private async getCollection(smartContractAddress: string) {
    const collection = await lastValueFrom(
      this.grpcCollection
        .findUnique(
          encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
            where: { smartContractAddress },
            select: {
              smartContractAddress: true,
              stakingContractAddresses: true,
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

    return collection;
  }

  private async getStakingContractAddresses(smartContractAddress: string) {
    const collection = await this.getCollection(smartContractAddress);
    if (collection?.stakingContractAddresses) {
      return collection.stakingContractAddresses
        .map((a: string) => [a.toLowerCase(), toChecksumAddress(a)])
        .flat();
    } else {
      return null;
    }
  }

  private async getTransferBlacklistAddresses(smartContractAddress: string) {
    const transferBlacklistAddresses = [
      ...TokenActivityService.WOV_CONTRACT_ADDRESSES,
    ];
    const stakingContractAddresses = await this.getStakingContractAddresses(
      smartContractAddress,
    );
    if (stakingContractAddresses) {
      transferBlacklistAddresses.push(...stakingContractAddresses);
    }

    return transferBlacklistAddresses;
  }

  async getActivity({
    smartContractAddress,
    tokenId,
    page,
    perPage,
    fromDate,
  }: GetTokenActivityArgs) {
    const blacklistAddresses = await this.getTransferBlacklistAddresses(
      smartContractAddress,
    );
    const stakingContractAddresses = await this.getStakingContractAddresses(
      smartContractAddress,
    );
    // JSONPath equality operator is case sensitive so we compare the addresses
    // with both the lowercase and the checksum version.
    // TODO: Find out if all addresses in the DB use either lowercase or checksum format.
    const lowercaseAddress = smartContractAddress.toLowerCase();
    const checksumAddress = toChecksumAddress(smartContractAddress);

    const query = knexPg
      .table('BlockchainEvent')
      .select('*')
      // Not all events have NFT
      .where(
        'returnValues',
        '@@',
        `(!exists($.nft) || $.nft == "${lowercaseAddress}" || $.nft == "${checksumAddress}") && $.tokenId == "${tokenId}"`,
      )
      .where((builder) => {
        builder
          .whereIn('event', [
            'auctionExecuted',
            'cancelAuctionEvent',
            'newAuction',
            'cancel',
            'listing',
            'purchase',
            'cancelNonCustodial',
            'listingNonCustodial',
            'purchaseNonCustodial',
            'CloseBuyOffer',
            'NewBuyOffer',
            'OfferAccepted',
          ])
          .orWhere((builder) => {
            // Transfer
            builder
              .where('event', '=', 'Transfer')
              .where('address', '=', `${smartContractAddress}`)
              // The sender is NOT a contract.
              .whereNotIn(
                knexPg.raw(`"returnValues"->>'from'::CITEXT`) as any,
                blacklistAddresses,
              )
              // The receiver is NOT a contract.
              .whereNotIn(
                knexPg.raw(`"returnValues"->>'to'::CITEXT`) as any,
                blacklistAddresses,
              );
          })
          .orWhere((builder) => {
            if (stakingContractAddresses) {
              // Ticket / CloseTicket
              builder
                .whereIn('event', ['Ticket', 'CloseTicket'])
                .whereIn('address', stakingContractAddresses);
            }
          });
      })
      .orderByRaw(`("meta"->'blockNumber')::INT DESC`)
      .orderByRaw(`("meta"->'txID')`)
      .orderByRaw(`("meta"->'clauseIndex')::INT DESC`)
      .offset((page - 1) * perPage)
      .limit(perPage + 1); // We fetch one more item to check if there are more.

    if (fromDate) {
      const timestamp = new Date(fromDate).getTime() / 1000;
      query.where('meta', '@@', `$.blockTimestamp <= ${timestamp}`);
    }

    const response: any[] = await this.prisma.$queryRawUnsafe(query.toString());

    const events = await this.activityService.getActivityFromRawResponse(
      response.slice(0, perPage),
      { includeCollection: false, includeToken: false },
    );

    return {
      hasMore: response.length > perPage,
      events: events,
    };
  }
}
