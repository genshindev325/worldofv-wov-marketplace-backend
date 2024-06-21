import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GetUserActivityArgs } from '@generated/ts-proto/services/activity';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/blockchain';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Cache } from 'cache-manager';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import { lastValueFrom, map } from 'rxjs';
import Web3 from 'web3';
import { ActivityService } from '../activity.service';

const knexPg = knex({ client: 'pg' });
const toChecksumAddress = Web3.utils.toChecksumAddress;

@Injectable()
export class UserActivityService implements OnModuleInit {
  private static readonly COLLECTIONS_CACHE_KEY = 'USER_ACTIVITY_COLLECTIONS';
  private static readonly COLLECTIONS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  private static readonly WOV_CONTRACT_ADDRESSES = [
    process.env.WOV_BID_AUCTION_ADDRESS,
    process.env.WOV_SALE_V2_ADDRESS,
  ];

  private grpcCollection: CollectionServiceClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly activityService: ActivityService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
  }

  private async getCollectionsFromCache() {
    const cacheKey = UserActivityService.COLLECTIONS_CACHE_KEY;
    const cacheTTL = UserActivityService.COLLECTIONS_CACHE_TTL;

    let collections: any[] = await this.cacheManager.get(cacheKey);

    if (!collections) {
      collections = await lastValueFrom(
        this.grpcCollection
          .findMany(
            encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
              where: { type: 'EXTERNAL' },
              select: {
                smartContractAddress: true,
                stakingContractAddresses: true,
                isVisible: true,
              },
            }),
          )
          .pipe(map(({ collections }) => collections)),
      );

      this.cacheManager.set(cacheKey, collections, cacheTTL);
    }

    return collections;
  }

  private async getTransferBlacklistAddresses() {
    const collections = await this.getCollectionsFromCache();

    const transferBlacklistAddresses = [
      ...UserActivityService.WOV_CONTRACT_ADDRESSES,
    ];

    for (const { stakingContractAddresses } of collections) {
      if (stakingContractAddresses) {
        transferBlacklistAddresses.push(...stakingContractAddresses);
      }
    }

    return transferBlacklistAddresses;
  }

  private async getVisibleCollectionAddresses() {
    const collections = await this.getCollectionsFromCache();

    const eventAddresses = [process.env.WOV_MARKETPLACE_TOKEN_ADDRESS];

    for (const { smartContractAddress, isVisible } of collections) {
      if (isVisible) eventAddresses.push(smartContractAddress);
    }

    return eventAddresses;
  }

  async getActivity({
    userAddress,
    page,
    perPage,
    fromDate,
  }: GetUserActivityArgs) {
    const blacklistAddresses = await this.getTransferBlacklistAddresses();
    const collectionAddresses = await this.getVisibleCollectionAddresses();

    // JSONPath equality operator is case sensitive so we compare the addresses
    // with both the lowercase and the checksum version.
    // TODO: Find out if all addresses in the DB use either lowercase or checksum format.
    const lowercaseAddress = userAddress.toLowerCase();
    const checksumAddress = toChecksumAddress(userAddress);

    const idsQuery = knexPg
      .table('BlockchainEvent')
      .select(
        knexPg.raw(`("returnValues" ->> 'saleId') AS "saleId"`),
        knexPg.raw(`("returnValues" ->> 'auctionId') AS "auctionId"`),
      )
      .whereIn('event', ['listing', 'listingNonCustodial', 'newAuction'])
      .where(
        'returnValues',
        '@@',
        `$.seller == "${lowercaseAddress}" || $.seller == "${checksumAddress}"`,
      );

    const idsResponse = await this.prisma.$queryRawUnsafe<any[]>(
      idsQuery.toString(),
    );

    const saleIds = idsResponse.filter((r) => r.saleId).map((r) => r.saleId);

    const auctionIds = idsResponse
      .filter((r) => r.auctionId)
      .map((r) => r.auctionId);

    const query = knexPg
      .table('BlockchainEvent')
      .select('*')
      .where((builder) => {
        // The event targets a visible collection. Not all events contain the
        // `nft` property in the return values but it's faster to have one
        //global check.
        builder.whereRaw(
          `("returnValues"->>'nft')::CITEXT IS NULL OR ("returnValues"->>'nft')::CITEXT = ANY(?::text[])`,
          [collectionAddresses],
        );
      })
      .andWhere((builder) => {
        // Transfer
        builder
          .where((builder) => {
            builder
              .where('event', '=', 'Transfer')
              .andWhere((builder) => {
                builder
                  // The user is the sender.
                  .where(
                    'returnValues',
                    '@@',
                    `$.from == "${lowercaseAddress}" || $.from == "${checksumAddress}"`,
                  )
                  // The user is the receiver.
                  .orWhere(
                    'returnValues',
                    '@@',
                    `$.to == "${lowercaseAddress}" || $.to == "${checksumAddress}"`,
                  );
              })
              // The transfer originated from a visible collection.
              .whereIn('address', collectionAddresses)
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
          // auctionExecuted
          .orWhere((builder) => {
            builder
              .where('event', '=', 'auctionExecuted')
              .andWhere((builder) => {
                builder
                  // The user is the buyer.
                  .where(
                    'returnValues',
                    '@@',
                    `$.newOwner == "${lowercaseAddress}" || $.newOwner == "${checksumAddress}"`,
                  );

                if (auctionIds.length) {
                  builder
                    // The user is the seller.
                    .orWhereRaw(`"returnValues"->>'auctionId' = ANY(?)`, [
                      auctionIds,
                    ]);
                }
              });
          })
          // cancelAuctionEvent
          .orWhere((builder) => {
            builder
              .where('event', '=', 'cancelAuctionEvent')
              // The user is the seller.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // newAuction
          .orWhere((builder) => {
            builder
              .where('event', '=', 'newAuction')
              // The user is the seller.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // cancel
          .orWhere((builder) => {
            builder
              .whereIn('event', ['cancel', 'cancelNonCustodial'])
              // The user is the seller.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // listing
          .orWhere((builder) => {
            builder
              .whereIn('event', ['listing', 'listingNonCustodial'])
              // The user is the seller.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // purchase
          .orWhere((builder) => {
            builder
              .whereIn('event', ['purchase', 'purchaseNonCustodial'])
              .andWhere((builder) => {
                builder
                  // The user is the buyer.
                  .where(
                    'returnValues',
                    '@@',
                    `$.buyer == "${lowercaseAddress}" || $.buyer == "${checksumAddress}"`,
                  );

                if (saleIds.length) {
                  builder
                    // The user is the seller.
                    .orWhereRaw(`"returnValues"->>'saleId' = ANY(?)`, [
                      saleIds,
                    ]);
                }
              });
          })
          // CloseBuyOffer
          .orWhere((builder) => {
            builder
              .where('event', '=', 'CloseBuyOffer')
              // The user is the creator.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // NewBuyOffer
          .orWhere((builder) => {
            builder
              .where('event', '=', 'NewBuyOffer')
              // The user is the creator.
              .andWhere(
                'meta',
                '@@',
                `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
              );
          })
          // OfferAccepted
          .orWhere((builder) => {
            builder.where('event', '=', 'OfferAccepted').andWhere((builder) => {
              builder
                // The user is the owner.
                .where(
                  'meta',
                  '@@',
                  `$.txOrigin == "${lowercaseAddress}" || $.txOrigin == "${checksumAddress}"`,
                )
                // The user is the creator.
                .orWhere(
                  'returnValues',
                  '@@',
                  `$.buyer == "${lowercaseAddress}" || $.buyer == "${checksumAddress}"`,
                );
            });
          })
          // Ticket
          .orWhere((builder) => {
            builder
              .where('event', '=', 'Ticket')
              // The user is the sender.
              .andWhere(
                'returnValues',
                '@@',
                `$.user == "${lowercaseAddress}" || $.user == "${checksumAddress}"`,
              );
          })
          // CloseTicket
          .orWhere((builder) => {
            builder
              .where('event', '=', 'CloseTicket')
              // The user is the sender.
              .andWhere(
                'returnValues',
                '@@',
                `$.user == "${lowercaseAddress}" || $.user == "${checksumAddress}"`,
              );
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
      { includeCollection: true, includeToken: true },
    );

    return {
      hasMore: response.length > perPage,
      events: events,
    };
  }
}
