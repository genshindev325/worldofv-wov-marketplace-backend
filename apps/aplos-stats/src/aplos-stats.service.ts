import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheService } from '@app/price-conversion-cache';

import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { HttpService } from '@nestjs/axios';
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Collections,
  Interval,
  Marketplace,
  PrismaClient,
  SaleStats,
} from '@prisma/client/aplos-stats';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { GetCollectionsStatsArgs } from 'apps/gateway/src/aplos-stats/get-collections-stats.args';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { encodeSerializedJson } from 'common/serialized-json';
import { randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';

interface ExtendedSaleStats extends SaleStats {
  contractAddress: string;
  marketplace: Marketplace;
}

interface FetchCollectionActivityArgs {
  limit?: number;
  lastItemPrimary?: string;
  sortingField?: string;
  sortingDirection?: 'asc' | 'desc';
  sortingMarketplace?:
    | 'wov'
    | 'vesea'
    | 'other'
    | 'all'
    | 'collectionSize'
    | 'name'
    | 'contractAddress';
}

@Injectable()
export class AplosStatsService implements OnModuleInit {
  private static readonly APLOS_STATS_CACHE_KEY = 'APLOS_STATS';
  private static readonly APLOS_STATS_CACHE_TTL = 60 * 60 * 1000; // 1 h

  private grpcCollection: CollectionServiceClient;
  private grpcUser: UserServiceClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,

    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,

    private readonly priceConversionCache: PriceConversionCacheService,
  ) {}
  onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  private getSortingField(timeframe: Interval, findTotal: boolean) {
    return `volume${this.getTimeFilter(timeframe)}${
      findTotal ? 'Total' : ''
    }VET`;
  }

  private getTimeFilter(timeframe: Interval) {
    switch (timeframe) {
      case Interval.H24:
        return '24hr';
      case Interval.D7:
        return '7d';
      case Interval.D30:
        return '30d';
      default:
        return '';
    }
  }

  async getCurrentMonthFees() {
    const date = new Date();
    const startMonthDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
    ).toISOString();

    const discountedCollections = [
      '0xFFcC1c4492c3b49825712e9A8909E4fCEBfE6C02MVA',
      '0xb12D1D640F56173Ef3a47e5E1A1Fde96bA96ce14MVA',
      '0xd861BE8e33ebd09764BfcA242ca6a8c54dcf844AMVA',
      '0x73f32592df5C0dA73d56f34669d4ae28Ae1AfD9EMVA',
      '0x9Fa1702b8C0CA235F4171E7Bb554bB5aB4fa68b2MVA',
      '0x55cE12bB1af513c44F2135ca0B52f1eeC27203dEMVA',
      '0x9c872e8420EC38f404402Bea8F8F86D5d2C17782OG',
      '0x9932690b32c4c0cd4d86a53eca948d33b1556ae7',
    ].map((c) => c.toLowerCase());

    const volumes: any[] = await this.prisma.$queryRaw`
      select "contractAddress", sum(cast (ss."volumeVET" as numeric(30))) as volume
      from "Collections" c
      join "SaleStats" ss on c.id = ss."collectionsId" 
      where marketplace = 'WOV' 
      and c."createdAt" > ${startMonthDate}::timestamp
      and interval = 'H24'
      and ss."volumeVET"  is not null
      and ss."volumeVET" != '0'
      group by "contractAddress"
    `;

    const fees = volumes.reduce((acc: BigNumber, curr) => {
      const volume = new BigNumber(curr.volume);
      const fee = discountedCollections.includes(curr.contractAddress)
        ? volume.multipliedBy(0.01)
        : volume.multipliedBy(0.025);
      return acc.plus(fee);
    }, new BigNumber(0));

    return fees.toFixed(0);
  }

  async fetchCollectionActivity(args: FetchCollectionActivityArgs) {
    const environment =
      this.configService.getOrThrow('NODE_ENV') === 'development'
        ? 'testnet'
        : 'mainnet';
    let url = `https://api-test.veaplos.com/main/v1/marketplace/collectionActivity?net=${environment}`;

    Object.entries(args).forEach(([key, value]) => {
      if (value) {
        url = url + `&${key}=${value}`;
      }
    });

    const observable = this.httpService.get(url, {
      headers: {
        'x-api-key': this.configService.getOrThrow('APLOS_API_KEY'),
      },
    });

    const data = (await lastValueFrom(observable)).data;

    const marketplaces: Marketplace[] = [
      Marketplace.WOV,
      Marketplace.VESEA,
      Marketplace.OTHER,
      Marketplace.ALL,
    ];

    const intervals: Interval[] = [
      Interval.H24,
      Interval.D7,
      Interval.D30,
      Interval.ALL,
    ];

    const collectionsStats: {
      collections: Collections[];
      saleStats: ExtendedSaleStats[];
    } = data.page.reduce(
      (
        acc: {
          collections: Collections[];
          saleStats: ExtendedSaleStats[];
        },
        cur: any,
      ) => {
        const collectionsStats = marketplaces.map((marketplace) => {
          const id = randomUUID();
          const mpLower = marketplace.toLowerCase();
          const saleStats = intervals.map((interval) => {
            const timeFilter = this.getTimeFilter(interval);
            return {
              interval,
              volumeVET: cur[mpLower][`volume${timeFilter}VET`],
              volumeWOV: cur[mpLower][`volume${timeFilter}WOV`],
              volumeSumInVet: cur[mpLower][`volume${timeFilter}TotalVET`],
              itemsSold: cur[mpLower][`itemsSold${timeFilter}`],
              distinctItemsSold: cur[mpLower][`distinctItemsSold${timeFilter}`],
              percentageChangeVolVET:
                cur[mpLower][`percentageChange${timeFilter}VolVET`],
              percentageChangeVolWOV:
                cur[mpLower][`percentageChange${timeFilter}VolWOV`],
              percentageChangeItems:
                cur[mpLower][`percentageChange${timeFilter}Items`],
              ownerCount: cur[mpLower].ownerCount,
              collectionsId: id,
              contractAddress: cur.contractAddress,
              marketplace,
            };
          });
          const collections = {
            id,
            contractAddress: cur.contractAddress,
            name: cur.name,
            collectionSize: cur.collectionSize,
            floorPriceVET: cur[mpLower].floorPriceVET,
            floorPriceWOV: cur[mpLower].floorPriceWOV,
            averagePriceVET: cur[mpLower].averagePriceVET,
            averagePriceWOV: cur[mpLower].averagePriceWOV,
            itemsForSale: cur[mpLower].itemsForSale,
            highestOfferVET: cur[mpLower].highestOfferVET,
            highestOfferWOV: cur[mpLower].highestOfferWOV,
            marketplace: marketplace,
          };
          return { collections, saleStats };
        });

        return {
          collections: [
            ...acc.collections,
            ...collectionsStats.map(
              (collectionStats) => collectionStats.collections,
            ),
          ],
          saleStats: [
            ...acc.saleStats,
            ...collectionsStats
              .map((collectionStats) => collectionStats.saleStats)
              .flat(),
          ],
        };
      },
      { collections: [], saleStats: [] },
    );
    return collectionsStats;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async createAplosData() {
    const environment =
      this.configService.getOrThrow('NODE_ENV') === 'development'
        ? 'testnet'
        : 'mainnet';
    const url = `https://api-test.veaplos.com/main/v1/marketplace/collectionActivity?net=${environment}&limit=1`;

    const observable = this.httpService.get(url, {
      headers: {
        'x-api-key': this.configService.getOrThrow('APLOS_API_KEY'),
      },
    });

    const data = (await lastValueFrom(observable)).data;
    const collectionsStats = await this.fetchCollectionActivity({
      limit: data.totalItems,
    });
    const saleStats = collectionsStats.saleStats;
    saleStats.forEach((saleStat) => {
      delete saleStat.marketplace;
      delete saleStat.contractAddress;
    });
    await this.prisma.$transaction([
      this.prisma.collections.createMany({
        data: collectionsStats.collections,
      }),
      this.prisma.saleStats.createMany({
        data: saleStats,
      }),
    ]);
  }

  async getRawCollectionsStats(args: FetchCollectionActivityArgs) {
    const { collections, saleStats } = await this.fetchCollectionActivity(args);

    const collectionsRecord: Record<string, any> = {};

    collections.forEach(
      ({
        contractAddress,
        name,
        collectionSize,
        floorPriceVET,
        floorPriceWOV,
        averagePriceVET,
        averagePriceWOV,
        itemsForSale,
        highestOfferVET,
        highestOfferWOV,
        marketplace,
      }) => {
        if (!collectionsRecord[contractAddress]) {
          collectionsRecord[contractAddress] = {
            contractAddress,
            name,
            collectionSize,
            marketplaces: {},
          };
        }
        const collection = collectionsRecord[contractAddress];

        collection.marketplaces[marketplace] = {
          floorPriceVET,
          floorPriceWOV,
          averagePriceVET,
          averagePriceWOV,
          itemsForSale,
          highestOfferVET,
          highestOfferWOV,
          saleStats: new Map(),
        };
      },
    );
    saleStats.forEach((data: ExtendedSaleStats) => {
      const collection = collectionsRecord[data.contractAddress];
      collection.marketplaces[data.marketplace] = {
        ...collection.marketplaces[data.marketplace],
        saleStats: collection.marketplaces[data.marketplace].saleStats.set(
          data.interval,
          data,
        ),
      };
    });

    const collectionsData = await lastValueFrom(
      this.grpcCollection.findMany(
        encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
          where: {
            smartContractAddress: {
              in: collections.map((collection) => collection.contractAddress),
            },
          },
        }),
      ),
    );
    // aggregate off-chain data from our db
    collectionsData.collections.forEach((collectionData) => {
      // aplos return smart contract always lower case,
      // so we get the data and reassign the same lower case key in the map
      const collection =
        collectionsRecord[collectionData.smartContractAddress.toLowerCase()];
      collectionsRecord[collectionData.smartContractAddress.toLowerCase()] = {
        ...collection,
        collection: collectionData,
      };
    });

    // filter away collections not present in our db
    Object.keys(collectionsRecord).forEach((key) => {
      if (
        !collectionsRecord[key].collection &&
        key !== '0x5e6265680087520dc022d75f4c45f9ccd712ba97'
      )
        delete collectionsRecord[key];
    });

    return collectionsRecord;
  }

  async getCollectionsStats(args: GetCollectionsStatsArgs) {
    const { pagination, timeframe } = args;
    const { lastItemPrimary, perPage } = pagination;
    const sortingField = this.getSortingField(timeframe, false);

    const [collections, rates] = await Promise.all([
      this.getRawCollectionsStats({
        lastItemPrimary,
        limit: perPage,
        sortingDirection: 'desc',
        sortingField,
        sortingMarketplace: 'all',
      }),
      this.priceConversionCache.getLatestRatesByCurrency(),
    ]);

    const collectionsStats = [];

    for (const [contractAddress, collection] of Object.entries(collections)) {
      const wovMarketplace = collection.marketplaces.WOV;
      const allMarketplaces = collection.marketplaces.ALL;

      const allMarketplacesTimeframe = allMarketplaces.saleStats.get(timeframe);
      const wovMarketplaceTimeframe = wovMarketplace.saleStats.get(timeframe);

      const allMarketplacesTotal = allMarketplaces.saleStats.get(Interval.ALL);
      const wovMarketplaceTotal = wovMarketplace.saleStats.get(Interval.ALL);

      // Floor price is checked only for WoV marketplace
      const floorPriceVET = wovMarketplace.floorPriceVET;
      const floorPriceWOV = wovMarketplace.floorPriceWOV;
      const floorPriceVETtoUSD = new BigNumber(floorPriceVET).multipliedBy(
        rates['VET'],
      );
      const floorPriceWOVtoUSD = new BigNumber(floorPriceWOV).multipliedBy(
        rates['WoV'],
      );

      let floorPrice;
      if (floorPriceVETtoUSD.isFinite() && floorPriceWOVtoUSD.isFinite()) {
        floorPrice = floorPriceVETtoUSD.isGreaterThan(floorPriceWOVtoUSD)
          ? {
              price: floorPriceWOV,
              currency: 'WoV',
            }
          : {
              price: floorPriceVET,
              currency: 'VET',
            };
      } else if (floorPriceVETtoUSD.isFinite()) {
        floorPrice = {
          price: floorPriceVET,
          currency: 'VET',
        };
      } else {
        floorPrice = {
          price: floorPriceWOV,
          currency: 'WoV',
        };
      }

      const volumeVET = allMarketplacesTimeframe.volumeVET;
      const volumeWOV = wovMarketplaceTimeframe.volumeWOV;
      const volumeSumInVet = new BigNumber(volumeVET).plus(
        new BigNumber(volumeWOV)
          .multipliedBy(rates['WoV'])
          .dividedBy(rates['VET'])
          .toFixed(0),
      );

      let totalVolumeVET = new BigNumber(allMarketplacesTotal.volumeVET);
      let totalVolumeWOV = new BigNumber(wovMarketplaceTotal.volumeWOV);

      // We add the old contracts vol to the total vol for these collections
      switch (collection?.collection?.smartContractAddress) {
        // Genesis
        case '0x93Ae8aab337E58A6978E166f8132F59652cA6C56':
          totalVolumeVET = totalVolumeVET.plus(34820678 * 10 ** 18);
          totalVolumeWOV = totalVolumeWOV.plus(7547791 * 10 ** 18);
          break;
        // Genesis Special
        case '0x9aaB6e4e017964ec7C0F092d431c314F0CAF6B4B':
          totalVolumeVET = totalVolumeVET.plus(12949081 * 10 ** 18);
          totalVolumeWOV = totalVolumeWOV.plus(8718491 * 10 ** 18);
          break;
        // VeHashes
        case '0x2A7Bc6E39bCf51f5c55E7FC779E6b4DA30be30c3':
          totalVolumeVET = totalVolumeVET.plus(4041247 * 10 ** 18);
          totalVolumeWOV = totalVolumeWOV.plus(1348631 * 10 ** 18);
          break;
      }

      const totalVolumeSumInVet = new BigNumber(totalVolumeVET)
        .plus(
          new BigNumber(totalVolumeWOV)
            .multipliedBy(rates['WoV'])
            .dividedBy(rates['VET']),
        )
        .toFixed(0);

      //we filter out 0 volumes collections
      if (!volumeSumInVet.isZero()) {
        collectionsStats.push({
          smartContactAddress:
            collection?.collection?.smartContactAddress ?? contractAddress,
          name: collection?.collection?.name ?? collection.name,
          collection: collection.collection,
          floorPrice,
          averagePriceVET: wovMarketplace.averagePriceVET,
          averagePriceWOV: wovMarketplace.averagePriceWOV,
          itemsSold: allMarketplacesTimeframe.itemsSold,
          volumeVET,
          volumeWOV,
          volumeSumInVet: volumeSumInVet.toFixed(0),
          percentageChange: allMarketplacesTimeframe.percentageChangeVolVET,
          ownerCount: wovMarketplaceTotal.ownerCount,
          totalItemsSold: allMarketplacesTotal.itemsSold,
          totalVolumeVET: totalVolumeVET.toFixed(0),
          totalVolumeWOV: totalVolumeWOV.toFixed(0),
          totalVolumeSumInVet,
        });
      }
    }
    return collectionsStats;
  }

  async fetchBuyerActivity(args: FetchCollectionActivityArgs) {
    const environment =
      this.configService.getOrThrow('NODE_ENV') === 'development'
        ? 'testnet'
        : 'mainnet';
    let url = `https://api-test.veaplos.com/main/v1/marketplace/buyerActivity?net=${environment}`;

    Object.entries(args).forEach(([key, value]) => {
      if (value) {
        url = url + `&${key}=${value}`;
      }
    });

    const observable = this.httpService.get(url, {
      headers: {
        'x-api-key': this.configService.getOrThrow('APLOS_API_KEY'),
      },
    });

    return (await lastValueFrom(observable)).data;
  }

  async getBuyersStats(args: GetCollectionsStatsArgs) {
    const { pagination, timeframe } = args;
    const { lastItemPrimary, perPage } = pagination;
    const sortingField = this.getSortingField(timeframe, true);
    const timeFilter = this.getTimeFilter(timeframe);

    const buyerActivity = await this.fetchBuyerActivity({
      limit: perPage,
      lastItemPrimary,
      sortingDirection: 'desc',
      sortingField,
      sortingMarketplace: 'wov',
    });

    const [{ users }] = await Promise.all([
      lastValueFrom(
        this.grpcUser.findMany(
          encodeSerializedJson<PrismaUser.UserFindManyArgs>({
            where: {
              address: {
                in: buyerActivity.page.map((buyer: any) => buyer.buyerAddress),
              },
            },
          }),
        ),
      ),
      this.priceConversionCache.getLatestRatesByCurrency(),
    ]);

    const buyersStats = buyerActivity.page.map((buyer: any) => {
      const volumeVET = buyer.wov[`volume${timeFilter}VET`];
      const volumeWOV = buyer.wov[`volume${timeFilter}WOV`];
      const volumeSumInVet = buyer.wov[`volume${timeFilter}TotalVET`];

      const totalVolumeVET = buyer.wov.volumeVET;
      const totalVolumeWOV = buyer.wov.volumeWOV;
      const totalVolumeSumInVet = buyer.wov.volumeTotalVET;

      const user = users.find(
        (u) => u.address.toLowerCase() === buyer.buyerAddress.toLowerCase(),
      );

      if (volumeSumInVet !== '0') {
        return {
          buyerAddress: buyer.buyerAddress,
          user,
          itemsBought: buyer.wov[`items${timeFilter}`],
          volumeVET,
          volumeWOV,
          volumeSumInVet,
          percentageChange: buyer.wov[`percentageChange${timeFilter}VolVET`], //to replace with VET + WOV % change
          totalItemsBought: buyer.wov.totalItems,
          totalVolumeVET,
          totalVolumeWOV,
          totalVolumeSumInVet,
        };
      }
    });
    return buyersStats.filter((buyer: any) => buyer);
  }
}
