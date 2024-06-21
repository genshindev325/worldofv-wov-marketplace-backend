import { PriceConversionCacheService } from '@app/price-conversion-cache';
import { Offer } from '@generated/ts-proto/types/offer';
import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import {
  Offer as DatabaseOffer,
  OfferType,
  Prisma as PrismaOffer,
  PrismaClient,
} from '@prisma/client/offer';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import knex from 'knex';
import _ from 'lodash';
import Web3 from 'web3';

const knexPg = knex({ client: 'pg' });

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  private static readonly HIGHEST_OFFERS_CACHE_KEY = 'HIGHEST_OFFERS';

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly prisma: PrismaClient,
    readonly priceConversionCache: PriceConversionCacheService,
  ) {}

  prismaOfferToGrpc(offer: DatabaseOffer): Offer {
    // All properties are optional since the request from the client might
    // select only specific fields from the database.
    return {
      ...offer,
      type: offer?.type as Offer['type'],
      status: offer?.status as Offer['status'],
      price: offer?.price?.toFixed(0),
      startingTime: offer?.startingTime?.toISOString(),
      endTime: offer?.endTime?.toISOString(),
    };
  }

  async getHighestOffersFromCache() {
    const offers = await this.cacheManager.get<Record<string, Offer>>(
      OfferService.HIGHEST_OFFERS_CACHE_KEY,
    );

    if (!offers) {
      return this.refreshHighestOffersCache();
    }

    return offers;
  }

  async refreshHighestOffersCache() {
    const rates = await this.priceConversionCache.getLatestRatesByCurrency();
    const wrappedVetAddress = process.env.WRAPPED_VET_CONTRACT_ADDRESS;

    const query = knexPg
      .select('*')
      .from('Offer')
      .distinctOn('smartContractAddress', 'tokenId')
      .where('status', '=', 'ACTIVE')
      .where('endTime', '>', new Date().toISOString())
      .orderBy('smartContractAddress')
      .orderBy('tokenId')
      .orderByRaw(
        knexPg.raw(
          `(case when "addressVIP180" = ? then "price" * ? else "price" * ? end) desc`,
          [wrappedVetAddress, rates['vVET'], rates['WoV']],
        ),
      );

    const response: DatabaseOffer[] = await this.prisma.$queryRawUnsafe(
      query.toString(),
    );

    const [collectionOffers, tokenOffers] = _.partition(
      response,
      (o) => o.type === OfferType.COLLECTION,
    );

    const highestOffers: Record<string, Offer> = {};

    // Add all collection offers to the map
    for (const offer of collectionOffers) {
      const address = Web3.utils.toChecksumAddress(offer.smartContractAddress);
      highestOffers[address] = this.prismaOfferToGrpc(offer);
    }

    for (const offer of tokenOffers) {
      const address = Web3.utils.toChecksumAddress(offer.smartContractAddress);

      const candidates = [this.prismaOfferToGrpc(offer)];

      if (highestOffers[address]) {
        candidates.push(highestOffers[address]);
      }

      // If there is a collection offer with a higher price than the current
      // candidate use it instead of the current offer.

      const highestOffer = _.maxBy(candidates, (o) =>
        new BigNumber(o.price)
          .times(rates[getPaymentFromContractAddress(o.addressVIP180)])
          .div(1e18)
          .toNumber(),
      );

      highestOffers[`${address}_${offer.tokenId}`] = highestOffer;
    }

    await this.cacheManager.set(
      OfferService.HIGHEST_OFFERS_CACHE_KEY,
      highestOffers,
    );

    return highestOffers;
  }

  async getHighestOffer(smartContractAddress: string, tokenId?: string) {
    const highestOffers = await this.getHighestOffersFromCache();

    const checksumAddress = Web3.utils.toChecksumAddress(smartContractAddress);

    return (
      highestOffers[`${checksumAddress}_${tokenId}`] ||
      highestOffers[checksumAddress]
    );
  }

  async getHighestOffersForTokens(
    smartContractAddress: string,
    tokenIds: string[],
  ) {
    const highestOffers = await this.getHighestOffersFromCache();
    const checksumAddress = Web3.utils.toChecksumAddress(smartContractAddress);
    const offers: Record<string, Offer> = {};

    for (const tokenId of tokenIds) {
      const key = `${checksumAddress}_${tokenId}`;

      if (highestOffers[key]) {
        offers[key] = highestOffers[key];
      } else if (highestOffers[checksumAddress]) {
        offers[key] = highestOffers[checksumAddress];
      }
    }

    return offers;
  }

  async upsert(
    where: PrismaOffer.OfferWhereUniqueInput,
    data: PrismaOffer.OfferCreateInput,
  ): Promise<DatabaseOffer> {
    return this.prisma.offer.upsert({ where, update: data, create: data });
  }
}
