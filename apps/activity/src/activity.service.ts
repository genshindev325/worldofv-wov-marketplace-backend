import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  ActivityEvent,
  ActivityEventKind,
} from '@generated/ts-proto/services/activity';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Asset, AssetSize } from '@generated/ts-proto/types/asset';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { BlockchainEvent, PrismaClient } from '@prisma/client/blockchain';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { ZERO_ADDRESS } from 'common/constants';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import isBurnAddress from 'common/is-burn-address';
import isEditionId from 'common/is-edition-id.helper';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import _ from 'lodash';
import { lastValueFrom, map } from 'rxjs';
import Web3 from 'web3';

const knexPg = knex({ client: 'pg' });
const toChecksumAddress = Web3.utils.toChecksumAddress;

export interface GetActivityFromRawResponseOptions {
  includeToken?: boolean;
  includeCollection?: boolean;
}

interface DatabaseEvent extends BlockchainEvent {
  meta: Record<string, any>;
  returnValues: Record<string, any>;
}

interface RawEvent extends DatabaseEvent {
  auxiliaryValues?: Record<string, any>;
}

@Injectable()
export class ActivityService implements OnModuleInit {
  private grpcCollection: CollectionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcUser: UserServiceClient;
  private grpcThumbnail: ImageThumbnailServiceClient;

  constructor(
    private readonly prisma: PrismaClient,

    private readonly contractService: ContractService,

    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly thumbnailClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcThumbnail = this.thumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  private static getEventDataFromRawEvent(entry: RawEvent) {
    const meta = entry.meta;
    const returnValues = entry.returnValues;
    const auxiliaryValues = entry.auxiliaryValues;

    const dateTime = new Date(meta.blockTimestamp * 1000).toISOString();

    const data: Partial<ActivityEvent> = { dateTime };

    switch (entry.event) {
      case 'Transfer':
        data.fromAddress = returnValues.from;
        data.toAddress = returnValues.to;

        if (returnValues.from === ZERO_ADDRESS) {
          data.event = ActivityEventKind.MINT;
          data.fromAddress = undefined;
        } else if (isBurnAddress(returnValues.to)) {
          data.event = ActivityEventKind.BURN;
          data.toAddress = undefined;
        } else {
          data.event = ActivityEventKind.TRANSFER;
        }

        data.smartContractAddress = entry.address;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          entry.address,
          returnValues.tokenId,
        );

        break;

      case 'auctionExecuted':
        data.resourceId = returnValues.auctionId;
        data.fromAddress = auxiliaryValues.seller;

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        if (auxiliaryValues.isVIP180) {
          data.payment = auxiliaryValues.addressVIP180;
        }

        if (returnValues.price === '0') {
          data.event = ActivityEventKind.AUCTION_EXPIRED;
          data.price = auxiliaryValues.price;
        } else {
          data.event = ActivityEventKind.AUCTION_SETTLED;
          data.price = returnValues.price;
          data.toAddress = returnValues.newOwner;
        }

        break;

      case 'cancelAuctionEvent':
        data.event = ActivityEventKind.AUCTION_CANCELED;
        data.resourceId = returnValues.auctionId;
        data.fromAddress = meta.txOrigin;

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        break;

      case 'newAuction':
        data.event = ActivityEventKind.AUCTION_CREATED;
        data.resourceId = returnValues.auctionId;
        data.fromAddress = returnValues.seller;

        data.price = returnValues.price;

        if (returnValues.isVIP180) {
          data.payment = returnValues.addressVIP180;
        }

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        break;

      case 'cancel':
      case 'cancelNonCustodial':
        data.event = ActivityEventKind.SALE_CANCELED;
        data.resourceId = returnValues.saleId;
        data.fromAddress = meta.txOrigin;

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        break;

      case 'listing':
      case 'listingNonCustodial':
        data.event = ActivityEventKind.SALE_CREATED;
        data.resourceId = returnValues.saleId;
        data.fromAddress = returnValues.seller;

        data.price = returnValues.price;

        if (returnValues.isVIP180) {
          data.payment = returnValues.addressVIP180;
        }

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        break;

      case 'purchase':
      case 'purchaseNonCustodial':
        data.event = ActivityEventKind.SALE_SETTLED;
        data.resourceId = returnValues.saleId;

        data.fromAddress = auxiliaryValues.seller;

        data.toAddress = returnValues.buyer;

        data.price = auxiliaryValues.price;

        if (auxiliaryValues.isVIP180) {
          data.payment = auxiliaryValues.addressVIP180;
        }

        data.smartContractAddress = returnValues.nft;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          returnValues.nft,
          returnValues.tokenId,
        );

        break;

      case 'CloseBuyOffer':
        data.event = ActivityEventKind.OFFER_CANCELED;
        data.resourceId = returnValues.offerId;
        data.fromAddress = meta.txOrigin;

        data.smartContractAddress = returnValues.nft;

        if (returnValues.tokenId !== '0') {
          data.tokenId = getTokenIdFromEditionId(
            returnValues.nft,
            returnValues.tokenId,
          );

          if (isEditionId(returnValues.nft, returnValues.tokenId)) {
            data.editionId = returnValues.tokenId;
          }
        }

        break;

      case 'NewBuyOffer':
        data.event = ActivityEventKind.OFFER_CREATED;
        data.resourceId = returnValues.offerId;
        data.fromAddress = meta.txOrigin;

        data.price = returnValues.price;
        data.payment = returnValues.addressVIP180;

        data.smartContractAddress = returnValues.nft;

        if (returnValues.tokenId !== '0') {
          data.tokenId = getTokenIdFromEditionId(
            returnValues.nft,
            returnValues.tokenId,
          );

          if (isEditionId(returnValues.nft, returnValues.tokenId)) {
            data.editionId = returnValues.tokenId;
          }
        }

        break;

      case 'OfferAccepted':
        data.event = ActivityEventKind.OFFER_ACCEPTED;
        data.resourceId = returnValues.offerId;

        data.fromAddress = meta.txOrigin;
        data.toAddress = returnValues.buyer;

        data.price = returnValues.value;
        data.payment = returnValues.vip180;

        data.smartContractAddress = returnValues.nft;

        if (returnValues.tokenId !== '0') {
          data.tokenId = getTokenIdFromEditionId(
            returnValues.nft,
            returnValues.tokenId,
          );

          if (isEditionId(returnValues.nft, returnValues.tokenId)) {
            data.editionId = returnValues.tokenId;
          }
        }

        break;

      case 'Ticket':
        data.event = ActivityEventKind.STAKE_STARTED;

        data.fromAddress = returnValues.user;
        data.smartContractAddress = auxiliaryValues.smartContractAddress;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          auxiliaryValues.smartContractAddress,
          returnValues.tokenId,
        );

        break;

      case 'CloseTicket':
        data.event = ActivityEventKind.STAKE_ENDED;

        data.toAddress = returnValues.user;
        data.smartContractAddress = auxiliaryValues.smartContractAddress;
        data.editionId = returnValues.tokenId;
        data.tokenId = getTokenIdFromEditionId(
          auxiliaryValues.smartContractAddress,
          returnValues.tokenId,
        );
        break;
    }

    data.smartContractAddress = toChecksumAddress(data.smartContractAddress);

    if (data.fromAddress) {
      data.fromAddress = toChecksumAddress(data.fromAddress);
    }

    if (data.toAddress) {
      data.toAddress = toChecksumAddress(data.toAddress);
    }

    return data as ActivityEvent;
  }

  /**
   * @returns Map [smart contract address]_[token id] -> [asset]
   */
  private async fetchAssets(
    tokenIds: { smartContractAddress: string; tokenId: string }[],
  ) {
    const assetsById = new Map<string, Asset>();

    const items = await lastValueFrom(
      this.grpcThumbnail
        .getManyTokenAssets({
          identifiers: tokenIds,
          filters: { sizes: [AssetSize.STATIC_COVER_128] },
        })
        .pipe(map(({ items }) => items || {})),
    );

    for (const [key, { assets }] of Object.entries(items)) {
      assetsById.set(key, assets[0]);
    }

    return assetsById;
  }

  /**
   * @returns Map [smart contract address] -> [collection]
   */
  private async fetchCollections(smartContractAddresses: string[]) {
    const { collections } = await lastValueFrom(
      this.grpcCollection.findMany(
        encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
          where: { smartContractAddress: { in: smartContractAddresses } },
        }),
      ),
    );

    return new Map(
      collections?.map((collection) => [
        Web3.utils.toChecksumAddress(collection.smartContractAddress),
        collection,
      ]),
    );
  }

  /**
   * @returns Map [smart contract address]_[token id] -> [token]
   */
  private async fetchTokens(
    tokenIds: { smartContractAddress: string; tokenId: string }[],
  ) {
    const { tokens } = await lastValueFrom(
      this.grpcToken.findMany(
        encodeSerializedJson<PrismaNft.TokenFindManyArgs>({
          where: { OR: tokenIds },
        }),
      ),
    );

    return new Map(
      tokens?.map((token) => {
        const addr = Web3.utils.toChecksumAddress(token.smartContractAddress);
        return [`${addr}_${token.tokenId}`, token];
      }),
    );
  }

  /**
   * @returns Map [user address] -> [user]
   */
  private async fetchUsers(userAddresses: string[]) {
    const { users } = await lastValueFrom(
      this.grpcUser.findMany(
        encodeSerializedJson<PrismaUser.UserFindManyArgs>({
          where: { address: { in: userAddresses } },
        }),
      ),
    );

    return new Map(
      users?.map((user) => [Web3.utils.toChecksumAddress(user.address), user]),
    );
  }

  async getActivityFromRawResponse(
    entries: DatabaseEvent[],
    options?: GetActivityFromRawResponseOptions,
  ) {
    // When we fetch the events from the table some of them do not contain
    // all the necessary information, for example 'purchase' events do not
    // contain the price but 'listing' events do.
    // To work around this issue we join the return values of the event that
    // created the resource. In the previous example the 'purchase' events would
    // be joined with the return values of the corresponding 'listing' event.
    // We do this in a separate query because I haven't been able to find a way
    // to perform such a complex join efficently in postgres.
    const auxiliaryValuesQuery = knexPg
      .table('BlockchainEvent')
      .select(['event', 'returnValues'])
      .where(false)
      .orWhere((builder) => {
        const auctionIds: string[] = entries
          .filter((e) => e.event === 'auctionExecuted')
          .map((e) => e.returnValues.auctionId);

        if (!auctionIds.length) return;

        builder
          .where('event', '=', 'newAuction')
          .andWhere(
            'returnValues',
            '@@',
            auctionIds.map((a) => `$.auctionId == "${a}"`).join(' || '),
          );
      })
      .orWhere((builder) => {
        const saleIds: string[] = entries
          .filter(
            (e) => e.event === 'purchase' || e.event === 'purchaseNonCustodial',
          )
          .map((e) => e.returnValues.saleId);

        if (!saleIds.length) return;

        builder
          .whereIn('event', ['listing', 'listingNonCustodial'])
          .andWhere(
            'returnValues',
            '@@',
            saleIds.map((a) => `$.saleId == "${a}"`).join(' || '),
          );
      });

    const stakingContractAddresses = _.uniqWith(
      entries
        .filter((e) => e.event === 'Ticket' || e.event === 'CloseTicket')
        .map((entry) => entry.address),
      isSameAddress,
    );

    const [auxiliaryValuesResponse, auxiliaryAddresses]: any[] =
      await Promise.all([
        this.prisma.$queryRawUnsafe(auxiliaryValuesQuery.toString()),

        Promise.all(
          stakingContractAddresses.map(async (stakingContractAddress) => {
            const contract = this.contractService.getContract(
              stakingContractAddress,
              'staking',
            );

            const smartContractAddress = await contract.methods
              .pfpCollection()
              .call();

            return [
              toChecksumAddress(stakingContractAddress),
              toChecksumAddress(smartContractAddress),
            ];
          }),
        ),
      ]);
    const auxiliaryAddressesById = new Map(auxiliaryAddresses);

    const auctionsById = new Map(
      auxiliaryValuesResponse
        .filter((a: any) => a.event === 'newAuction')
        .map(({ returnValues }: any) => [returnValues.auctionId, returnValues]),
    );

    const salesById = new Map(
      auxiliaryValuesResponse
        .filter(
          (a: any) =>
            a.event === 'listing' || a.event === 'listingNonCustodial',
        )
        .map(({ returnValues }: any) => [returnValues.saleId, returnValues]),
    );

    const events = entries
      .map((entry) => ({
        ...entry,
        auxiliaryValues:
          entry.event === 'auctionExecuted'
            ? auctionsById.get(entry.returnValues.auctionId)
            : entry.event === 'purchase' ||
              entry.event === 'purchaseNonCustodial'
            ? salesById.get(entry.returnValues.saleId)
            : entry.event === 'Ticket' || entry.event === 'CloseTicket'
            ? {
                smartContractAddress: auxiliaryAddressesById.get(
                  toChecksumAddress(entry.address),
                ),
              }
            : null,
      }))
      .map(ActivityService.getEventDataFromRawEvent);
    const contractAddresses = _.uniq(
      events.map(({ smartContractAddress }) => smartContractAddress),
    );

    const tokenIds = _.uniqWith(
      events
        .filter((event) => event.tokenId)
        .map(({ smartContractAddress, tokenId }) => ({
          smartContractAddress,
          tokenId,
        })),
      _.isEqual,
    );

    const userAddresses = _.uniq(
      events.flatMap(({ fromAddress, toAddress }) => {
        const addresses = [];
        if (fromAddress) addresses.push(fromAddress);
        if (toAddress) addresses.push(toAddress);
        return addresses;
      }),
    );

    const [collectionsById, tokensById, assetsById, usersById] =
      await Promise.all([
        options?.includeCollection
          ? this.fetchCollections(contractAddresses)
          : null,
        options?.includeToken ? this.fetchTokens(tokenIds) : null,
        options?.includeToken ? this.fetchAssets(tokenIds) : null,
        this.fetchUsers(userAddresses),
      ]);

    for (const event of events) {
      const tokenKey = `${event.smartContractAddress}_${event.tokenId}`;

      event.collection = collectionsById?.get(event.smartContractAddress);
      event.token = tokensById?.get(tokenKey);

      if (event.tokenId) {
        event.asset = assetsById?.get(tokenKey);
      } else if (event.collection.thumbnailImageUrl) {
        event.asset = {
          size: AssetSize.ORIGINAL,
          mimeType: 'image/*',
          url: event.collection.thumbnailImageUrl,
        };
      }

      event.fromUser = usersById.get(event.fromAddress);
      event.toUser = event.toAddress ? usersById.get(event.toAddress) : null;
    }

    return events;
  }
}
