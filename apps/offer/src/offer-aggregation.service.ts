import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheService } from '@app/price-conversion-cache';
import {
  AuctionServiceClient,
  AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/auction';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  AggregatedOffer,
  AggregatedOfferEdition,
  AggregatedOffersForUserResponse,
  GetOffersForTokenArgs,
  GetOffersForUserArgs,
  UserOfferType,
} from '@generated/ts-proto/services/offer';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Asset, AssetSize } from '@generated/ts-proto/types/asset';
import { Collection } from '@generated/ts-proto/types/collection';
import { Token } from '@generated/ts-proto/types/token';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaAuction } from '@prisma/client/auction';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Offer as DatabaseOffer, PrismaClient } from '@prisma/client/offer';
import { Prisma as PrismaSale } from '@prisma/client/sale';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import _ from 'lodash';
import { lastValueFrom, map } from 'rxjs';
import Web3 from 'web3';
import { OfferService } from './offer.service';

const knexPg = knex({ client: 'pg' });

@Injectable()
export class OfferAggregationService implements OnModuleInit {
  private readonly logger = new Logger(OfferAggregationService.name);

  private grpcEdition: EditionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;
  private grpcUser: UserServiceClient;
  private grpcSale: SaleServiceClient;
  private grpcAuction: AuctionServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.SALE)
    private readonly saleClient: ClientGrpc,

    @Inject(GrpcClientKind.AUCTION)
    private readonly auctionClient: ClientGrpc,

    private readonly prisma: PrismaClient,

    private readonly priceConversionCache: PriceConversionCacheService,

    private readonly offerService: OfferService,
  ) {}

  async onModuleInit() {
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);
    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);
    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  async getOffersForUser({
    address,
    type,
    filters,
    acceptorAddress,
    pagination,
  }: GetOffersForUserArgs): Promise<AggregatedOffersForUserResponse> {
    const rates = await this.priceConversionCache.getLatestRatesByCurrency();
    const wrappedVetAddress = process.env.WRAPPED_VET_CONTRACT_ADDRESS;

    const page = pagination?.page || 1;
    const limit = pagination?.perPage || 0;
    const offset = (page - 1) * limit;

    const query = knexPg
      .from('Offer')
      .where('status', '=', 'ACTIVE')
      .where('endTime', '>', new Date().toISOString());

    if (filters?.type) {
      query.where('type', '=', filters.type);
    }
    if (filters?.smartContractAddress) {
      query.where(
        'Offer.smartContractAddress',
        '=',
        filters?.smartContractAddress,
      );
    }
    if (filters?.tokenIds) {
      query.whereIn('tokenId', filters.tokenIds);
    }
    if (filters?.editionIds) {
      query.whereIn('editionId', filters.editionIds);
    }

    switch (type) {
      case UserOfferType.CREATED:
        query.where('bidderAddress', '=', address);
        break;

      case UserOfferType.RECEIVED:
        const { editions } = await lastValueFrom(
          this.grpcEdition.findMany(
            encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
              where: {
                ownerAddress: address,
                smartContractAddress: filters?.smartContractAddress,
                tokenId: { in: filters?.tokenIds },
                editionId: { in: filters?.editionIds },
              },
              select: {
                smartContractAddress: true,
                tokenId: true,
                editionId: true,
              },
            }),
          ),
        );

        const editionsByContract = _.groupBy(editions, 'smartContractAddress');
        // If the user doesn't have any editions he will not have any offer so
        // we can return directly.
        if (!Object.keys(editionsByContract).length)
          return {
            offers: [],
            meta: {
              hasMore: false,
              total: 0,
            },
          };

        query.where((builder) => {
          for (const [smartContractAddress, editions] of Object.entries(
            editionsByContract,
          )) {
            builder.orWhere((builder) => {
              builder
                .where('Offer.smartContractAddress', '=', smartContractAddress)
                .where((builder) => {
                  builder
                    .orWhere('type', '=', 'COLLECTION')
                    .orWhere((builder) => {
                      builder.where('type', '=', 'TOKEN').whereIn(
                        'tokenId',
                        editions.map((e) => e.tokenId),
                      );
                    })
                    .orWhere((builder) => {
                      builder.where('type', '=', 'EDITION').whereIn(
                        'editionId',
                        editions.map((e) => e.editionId),
                      );
                    });
                });
            });
          }
        });

        // A user cannot be a recipient for an offer he created.
        query.where('bidderAddress', '!=', address);

        // If a user is on his own profile page (or for the count)
        // we filter out offers under minimum price
        if (acceptorAddress && acceptorAddress === address) {
          query.leftJoin('MinimumOffer', (builder) => {
            builder
              .on(
                'Offer.smartContractAddress',
                '=',
                'MinimumOffer.smartContractAddress',
              )
              .andOn('userAddress', '=', knexPg.raw('?', acceptorAddress));
          });

          query.where((builder) => {
            builder
              .whereNull('MinimumOffer.price')
              .orWhereRaw(
                `(case when "addressVIP180" = ? then "MinimumOffer"."price" < "Offer"."price" else "MinimumOffer"."price" < ("Offer"."price" * ? / ?) end)`,
                [wrappedVetAddress, rates['WoV'], rates['vVET']],
              );
          });
        }

        break;
    }

    const countQuery = query.clone().count('offerId');

    const orderedQuery = query
      .select('Offer.*')
      .orderByRaw(
        knexPg.raw(
          `(case when "addressVIP180" = ? then "Offer"."price" * ? else "Offer"."price" * ? end) desc`,
          [wrappedVetAddress, rates['vVET'], rates['WoV']],
        ),
      )
      .offset(offset)
      .limit(limit);

    const [offersResponse, countResponse]: any[] = await Promise.all([
      limit !== 0
        ? this.prisma.$queryRawUnsafe<any>(orderedQuery.toString())
        : [],
      this.prisma.$queryRawUnsafe(countQuery.toString()),
    ]);

    const offers = await this.aggregateOffers(offersResponse, acceptorAddress);
    const total = Number(countResponse[0].count);

    return {
      offers,
      meta: {
        total,
        hasMore: total > page * limit,
      },
    };
  }

  async getOffersForToken({
    smartContractAddress,
    tokenId,
    acceptorAddress,
  }: GetOffersForTokenArgs) {
    const rates = await this.priceConversionCache.getLatestRatesByCurrency();
    const wrappedVetAddress = process.env.WRAPPED_VET_CONTRACT_ADDRESS;

    const query = knexPg
      .from('Offer')
      .select('*')
      .where('status', '=', 'ACTIVE')
      .where('endTime', '>', new Date().toISOString())
      .where('smartContractAddress', '=', smartContractAddress)
      .where((builder) => {
        builder.orWhere('type', '=', 'COLLECTION').orWhere((builder) => {
          builder
            .whereIn('type', ['TOKEN', 'EDITION'])
            .where('tokenId', '=', tokenId);
        });
      })
      .orderByRaw(
        knexPg.raw(
          `(case when "addressVIP180" = ? then "price" * ? else "price" * ? end) desc`,
          [wrappedVetAddress, rates['vVET'], rates['WoV']],
        ),
      );

    const response: DatabaseOffer[] = await this.prisma.$queryRawUnsafe(
      query.toString(),
    );

    return this.aggregateOffers(response, acceptorAddress);
  }

  /**
   * Fetch the auxiliary data for the offers and additionally filter out offers
   * where the token was burned or the price is below the acceptor address'
   * minimum offer for the collection.
   */
  async aggregateOffers(
    rawOffers: DatabaseOffer[],
    acceptorAddress?: string,
  ): Promise<AggregatedOffer[]> {
    rawOffers = rawOffers.map((offer) => ({
      ...offer,
      bidderAddress: Web3.utils.toChecksumAddress(offer.bidderAddress),
      smartContractAddress: Web3.utils.toChecksumAddress(
        offer.smartContractAddress,
      ),
    }));

    const bidderAddresses = _.uniq(rawOffers.map((o) => o.bidderAddress));

    const smartContractAddresses = _.uniq(
      rawOffers.map((o) => o.smartContractAddress),
    );

    const tokenIds = _.uniqWith(
      rawOffers
        .filter((o) => o.tokenId)
        .map((o) => _.pick(o, ['smartContractAddress', 'tokenId'])),
      _.isEqual,
    );

    const [tokens, editions, collections, assets, bidders] = await Promise.all([
      this.fetchTokens(tokenIds),
      acceptorAddress
        ? this.getEditionsForOffers(rawOffers, acceptorAddress)
        : null,
      this.fetchCollections(smartContractAddresses),
      this.fetchAssets(tokenIds),
      this.fetchUsers(bidderAddresses),
    ]);

    const offers = await Promise.all(
      rawOffers.map(async (offer) => {
        const tokenKey = offer.tokenId
          ? `${offer.smartContractAddress}_${offer.tokenId}`
          : null;

        const editionKey = offer.editionId
          ? `${offer.smartContractAddress}_${offer.tokenId}_${offer.editionId}`
          : null;

        const collection = collections.get(offer.smartContractAddress);
        const bidder = bidders.get(offer.bidderAddress);
        const token = tokenKey ? tokens.get(tokenKey) : null;

        let asset: Asset;

        if (offer.tokenId) {
          asset = assets?.get(tokenKey) || {
            size: AssetSize.ORIGINAL,
            mimeType: token.imageMimeType,
            url: token.imageUrl,
          };
        } else if (collection.thumbnailImageUrl) {
          asset = {
            size: AssetSize.ORIGINAL,
            mimeType: 'image/*',
            url: collection.thumbnailImageUrl,
          };
        }

        const offerEditions = editionKey
          ? editions?.get(editionKey)
          : tokenKey
          ? editions?.get(tokenKey)
          : editions?.get(offer.smartContractAddress);

        if (collection?.type === 'EXTERNAL') {
          offerEditions?.sort((a, b) => (b.rank || 0) - (a.rank || 0));
        } else {
          offerEditions?.sort(
            (a, b) => Number(b.editionId) - Number(a.editionId),
          );
        }

        const highestOffer = await this.offerService.getHighestOffer(
          offer.smartContractAddress,
          offer.tokenId,
        );

        return {
          ...this.offerService.prismaOfferToGrpc(offer),
          asset,
          token: token as Token,
          collection: collection as Collection,
          editions: offerEditions,
          bidder,
          highestOffer,
        };
      }),
    );

    return offers;
  }

  /**
   * @returns Map [smart contract address] -> [minimum offer]
   */
  private async getMinimumOffers(
    userAddress: string,
    smartContractAddresses: string[],
  ) {
    const response = await this.prisma.minimumOffer.findMany({
      where: {
        userAddress,
        smartContractAddress: { in: smartContractAddresses },
      },
    });

    return new Map(
      response?.map((mo) => [
        Web3.utils.toChecksumAddress(mo.smartContractAddress),
        mo,
      ]),
    );
  }

  /**
   * @returns Map [smart contract address]_[token id] -> [asset]
   */
  private async fetchAssets(
    tokenIds: { smartContractAddress: string; tokenId: string }[],
  ) {
    const assetsById = new Map<string, Asset>();

    const items = await lastValueFrom(
      this.grpcImageThumbnail
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
   * @returns Map [smart contract address]_[token id]_[edition id] -> [sale]
   */
  private async fetchSales(
    editionIds: {
      smartContractAddress: string;
      tokenId: string;
      editionId: string;
    }[],
  ) {
    const { sales } = await lastValueFrom(
      this.grpcSale.findMany(
        encodeSerializedJson<PrismaSale.SaleFindManyArgs>({
          where: { status: 'LISTED', OR: editionIds },
        }),
      ),
    );

    return new Map(
      sales?.map((sale) => {
        const addr = Web3.utils.toChecksumAddress(sale.smartContractAddress);
        return [`${addr}_${sale.tokenId}_${sale.editionId}`, sale];
      }),
    );
  }

  /**
   * @returns Map [smart contract address]_[token id]_[edition id] -> [sale]
   */
  private async fetchAuctions(
    editionIds: {
      smartContractAddress: string;
      tokenId: string;
      editionId: string;
    }[],
  ) {
    const { auctions } = await lastValueFrom(
      this.grpcAuction.findMany(
        encodeSerializedJson<PrismaAuction.AuctionFindManyArgs>({
          where: { status: { in: ['ACTIVE', 'TO_SETTLE'] }, OR: editionIds },
        }),
      ),
    );

    return new Map(
      auctions?.map((auction) => {
        const addr = Web3.utils.toChecksumAddress(auction.smartContractAddress);
        return [`${addr}_${auction.tokenId}_${auction.editionId}`, auction];
      }),
    );
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

  /**
   * Editions in the response are keyed with multiple keys to make it easier to
   * combine them with offers. Not particularly memory efficent but I haven't
   * found another way to do it in O(n) time.
   *
   * @returns Map [smart contract address]_[token id]_[edition id] -> [edition[]]
   *            & [smart contract address]_[token id]              -> [edition[]]
   *            & [smart contract address]                         -> [edition[]]
   */
  private async getEditionsForOffers(
    offers: DatabaseOffer[],
    acceptorAddress: string,
  ): Promise<Map<string, AggregatedOfferEdition[]>> {
    // We can't accept an offer with an edition owned by the initiator.
    offers = offers.filter(
      (o) => !isSameAddress(o.bidderAddress, acceptorAddress),
    );

    const uniqueIds = _.uniqWith(
      offers.map((o) => ({
        smartContractAddress: o.smartContractAddress,
        tokenId: o.tokenId || undefined,
        editionId: o.editionId || undefined,
      })),
      _.isEqual,
    );

    const { editions: rawEditions } = await lastValueFrom(
      this.grpcEdition.findMany(
        encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
          select: {
            smartContractAddress: true,
            stakingContractAddress: true,
            tokenId: true,
            editionId: true,
            ownerAddress: true,
          },
          where: {
            ownerAddress: acceptorAddress,
            OR: uniqueIds,
          },
        }),
      ),
    );

    const uniqueTokenIds = _.uniqWith(
      rawEditions?.map((e) => _.pick(e, ['smartContractAddress', 'tokenId'])),
      _.isEqual,
    );

    const uniqueEditionIds = _.uniqWith(
      rawEditions?.map((e) =>
        _.pick(e, ['smartContractAddress', 'tokenId', 'editionId']),
      ),
      _.isEqual,
    );

    const [assetsById, salesById, auctionsById, tokensById] = await Promise.all(
      [
        this.fetchAssets(uniqueTokenIds),
        this.fetchSales(uniqueEditionIds),
        this.fetchAuctions(uniqueEditionIds),
        this.fetchTokens(uniqueTokenIds),
      ],
    );

    const editionsById = new Map<string, AggregatedOfferEdition[]>();

    for (const edition of rawEditions || []) {
      edition.smartContractAddress = Web3.utils.toChecksumAddress(
        edition.smartContractAddress,
      );

      const tokenKey = `${edition.smartContractAddress}_${edition.tokenId}`;
      const editionKey = `${tokenKey}_${edition.editionId}`;

      const token = tokensById.get(tokenKey);
      const auction = auctionsById.get(editionKey);
      const sale = salesById.get(editionKey);

      const asset = assetsById.get(tokenKey) || {
        size: AssetSize.ORIGINAL,
        mimeType: token.imageMimeType,
        url: token.imageUrl,
      };

      const data = {
        ...edition,
        tokenName: token.name,
        royalty: token.royalty,
        rank: token.rank,
        auctionId: auction?.auctionId,
        saleId: sale?.saleId,
        saleAddressVIP180: sale?.addressVIP180,
        asset,
      };

      for (const key of [edition.smartContractAddress, tokenKey, editionKey]) {
        const existing = editionsById.get(key) ?? [];
        existing.push(data);
        editionsById.set(key, existing);
      }
    }

    return editionsById;
  }
}
