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
  OfferServiceClient,
  OFFER_SERVICE_NAME,
} from '@generated/ts-proto/services/offer';
import {
  SaleServiceClient,
  SALE_SERVICE_NAME,
} from '@generated/ts-proto/services/sale';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
  UserMediaType,
} from '@generated/ts-proto/services/thumbnail';
import { AssetSize } from '@generated/ts-proto/types/asset';
import { User } from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AuctionStatus, Prisma as PrismaAuction } from '@prisma/client/auction';
import {
  CollectionsType,
  Prisma,
  TokensCategory,
} from '@prisma/client/marketplace';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Offer } from '@prisma/client/offer';
import { Prisma as PrismaSale, SaleStatus } from '@prisma/client/sale';
import BigNumber from 'bignumber.js';
import { formatPrice } from 'common/format-price.helper';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import PrismaClientMarketplaceSync from './prisma-client-marketplace-sync';

@Injectable()
export class MarketplaceSyncService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceSyncService.name);

  private grpcCollection: CollectionServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;
  private grpcSale: SaleServiceClient;
  private grpcAuction: AuctionServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;
  private grpcOffer: OfferServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.SALE)
    private readonly saleClient: ClientGrpc,

    @Inject(GrpcClientKind.AUCTION)
    private readonly auctionClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    @Inject(GrpcClientKind.OFFER)
    private readonly offerClient: ClientGrpc,

    private readonly prisma: PrismaClientMarketplaceSync,

    private readonly priceConversionCache: PriceConversionCacheService,
  ) {}

  onModuleInit() {
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);

    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);

    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);

    this.grpcSale = this.saleClient.getService(SALE_SERVICE_NAME);

    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);

    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );

    this.grpcOffer = this.offerClient.getService(OFFER_SERVICE_NAME);
  }

  public async updateToken(
    smartContractAddress: string,
    tokenId: string,
  ): Promise<boolean> {
    const initialToken = await this.prisma.tokens.findUnique({
      where: {
        tokenId_smartContractAddress: { tokenId, smartContractAddress },
      },
    });

    /**
     * The `version` field in the tokens table is used to make sure the query
     * fails if the table has been updated after fetching the data.
     *
     * For more info see: https://en.wikipedia.org/wiki/Optimistic_concurrency_control
     */
    const initialVersion = initialToken?.version ?? 0;

    const token = await lastValueFrom(
      this.grpcToken
        .findFirst(
          encodeSerializedJson<PrismaNft.TokenFindFirstArgs>({
            where: { tokenId, smartContractAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) return of(null);
            else return throwError(() => err);
          }),
        ),
    );

    if (!token) {
      this.logger.warn(
        `Skipping update for token ${tokenId}/${smartContractAddress} because it was not present in the database.`,
      );
      return false;
    }

    const [editions, sales, auctions, media, highestOffer, rates] =
      await Promise.all([
        // Get all the editions associated to the token
        lastValueFrom(
          this.grpcEdition
            .findMany(
              encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
                where: { smartContractAddress, tokenId },
                orderBy: { editionId: 'asc' },
              }),
            )
            .pipe(map(({ editions }) => editions || [])),
        ),

        // Get all the sales for the token to find the minimum and update the editions
        lastValueFrom(
          this.grpcSale
            .findMany(
              encodeSerializedJson<PrismaSale.SaleFindManyArgs>({
                where: {
                  smartContractAddress,
                  tokenId,
                  status: SaleStatus.LISTED,
                },
              }),
            )
            .pipe(map(({ sales }) => sales || [])),
        ),

        // Get all the auctions for a token to find the minimum and update the editions
        lastValueFrom(
          this.grpcAuction
            .findMany(
              encodeSerializedJson<PrismaAuction.AuctionFindManyArgs>({
                where: {
                  smartContractAddress,
                  tokenId,
                  status: {
                    in: [AuctionStatus.ACTIVE, AuctionStatus.TO_SETTLE],
                  },
                },
              }),
            )
            .pipe(map(({ auctions }) => auctions || [])),
        ),

        // Get the media linked to the token
        this.getTokenMedia(tokenId, smartContractAddress),

        // Get the highest offer done to the token
        lastValueFrom(
          this.grpcOffer.findHighest({ smartContractAddress, tokenId }).pipe(
            map(({ offer }) => offer),
            catchError((err) => {
              if (err?.code === GrpcStatus.NOT_FOUND) return of(null);
              else return throwError(() => err);
            }),
          ),
        ),

        this.priceConversionCache.getLatestRatesByCurrency(),
      ]);

    const salesByEditionId = new Map(sales?.map((s) => [s.editionId, s]));
    const auctionsByEditionId = new Map(auctions?.map((a) => [a.editionId, a]));

    // WARN: It is very important that `editionData` is always sorted in the
    // same order before the query is built, otherwise a deadlock condition is
    // much more likely to occur when the marketplace service is replicated
    // multiple times.
    const editionData = editions.map((edition) => {
      const sale = salesByEditionId.get(edition.editionId);
      const auction = auctionsByEditionId.get(edition.editionId);

      const lastListedAt = Math.max(
        sale?.createdAt ?? 0,
        auction?.createdAt ?? 0,
      );

      // Calculate the edition updatedAt as the maximum value between the sale,
      // auction, and the edition updatedAt that is the last transfer block number.
      const updatedAt = Math.max(lastListedAt, edition.updatedAt ?? 0);

      return {
        ...edition,

        updatedAt: updatedAt || null,
        lastListedAt: lastListedAt || null,
        lastTransferredAt: edition.updatedAt,
        stakingContractAddress: edition.stakingContractAddress || null,
        isFreeShipping: edition.isFreeShipping || null,

        saleId: sale?.saleId || null,
        salePrice: sale ? formatPrice(sale.price) : null,
        saleAddressVIP180: sale?.addressVIP180 || null,

        auctionId: auction?.auctionId || null,
        auctionReservePrice: auction ? formatPrice(auction.reservePrice) : null,
        auctionHighestBid: auction ? formatPrice(auction.highestBid) : null,
        auctionAddressVIP180: auction?.addressVIP180 || null,
        auctionEndTime: auction ? new Date(auction.endTime) : null,
      };
    });

    const editionsOnSale =
      _.countBy(
        editionData,
        (edition) => edition.saleId !== null || edition.auctionId !== null,
      )?.true || 0;

    const editionsInGraveyard =
      _.countBy(editionData, (edition) =>
        isSameAddress(edition.ownerAddress, process.env.GRAVEYARD_ADDRESS),
      )?.true || 0;

    const lastEditionUpdatedAt =
      _.maxBy(editionData, 'updatedAt')?.updatedAt || null;

    const lastEditionTransferredAt =
      _.maxBy(editionData, 'lastTransferredAt')?.lastTransferredAt || null;

    const lastEditionListedAt =
      _.maxBy(editionData, 'lastListedAt')?.lastListedAt || null;

    const { minimumSale, maximumSale } = sales.reduce(
      ({ minimumSale, maximumSale }, current) => {
        const currentPrice = new BigNumber(current.price.toString());
        const minimumPrice = new BigNumber(minimumSale.price.toString());
        const maximumPrice = new BigNumber(maximumSale.price.toString());

        const currentUsdPrice = currentPrice.multipliedBy(
          rates[current.addressVIP180 ? 'WoV' : 'VET'],
        );
        const minimumUsdPrice = minimumPrice.multipliedBy(
          rates[minimumSale.addressVIP180 ? 'WoV' : 'VET'],
        );
        const maximumUsdPrice = maximumPrice.multipliedBy(
          rates[maximumSale.addressVIP180 ? 'WoV' : 'VET'],
        );

        if (currentUsdPrice.lt(minimumUsdPrice)) minimumSale = current;
        if (currentUsdPrice.gt(maximumUsdPrice)) maximumSale = current;

        return { minimumSale, maximumSale };
      },
      { minimumSale: sales?.[0], maximumSale: sales?.[0] },
    );

    const minimumAuction = auctions.reduce((prev, curr) => {
      const prevMinPrice = new BigNumber(
        (prev.highestBid || prev.reservePrice).toString(),
      );
      const currMinPrice = new BigNumber(
        (curr.highestBid || curr.reservePrice).toString(),
      );

      const prevUsd = prevMinPrice.multipliedBy(
        rates[prev.addressVIP180 ? 'WoV' : 'VET'],
      );
      const currUsd = currMinPrice.multipliedBy(
        rates[curr.addressVIP180 ? 'WoV' : 'VET'],
      );

      return prevUsd.lte(currUsd) ? prev : curr;
    }, auctions?.[0]);

    const tokenData = {
      tokenId: token.tokenId,
      smartContractAddress: token.smartContractAddress,
      name: token.name,
      creatorAddress: token.creatorAddress,
      editionsCount: token.editionsCount,
      editionsOnSale,
      editionsInGraveyard,
      categories: (token.categories as TokensCategory[]) || undefined,
      attributes: (token.attributes as any) || undefined,
      score: token.score,
      rank: token.rank,
      collectionId: token.collectionId,
      media,
      mintedAt: token.mintedAt,
      stakingEarnings: token.stakingEarnings,
      updatedAt: lastEditionUpdatedAt,
      lastTransferredAt: lastEditionTransferredAt,
      lastListedAt: lastEditionListedAt,

      highestOfferId: highestOffer?.offerId || null,
      highestOfferPrice: highestOffer ? formatPrice(highestOffer.price) : null,
      highestOfferAddressVIP180: highestOffer?.addressVIP180 || null,
      highestOfferEndTime: highestOffer?.endTime,

      minimumSaleId: minimumSale?.saleId || null,
      minimumSalePrice: minimumSale ? formatPrice(minimumSale.price) : null,
      minimumSaleAddressVIP180: minimumSale?.addressVIP180 || null,

      maximumSalePrice: maximumSale ? formatPrice(maximumSale.price) : null,

      minimumAuctionId: minimumAuction?.auctionId || null,
      minimumAuctionReservePrice: minimumAuction
        ? formatPrice(minimumAuction.reservePrice)
        : null,
      minimumAuctionHighestBid: minimumAuction
        ? formatPrice(minimumAuction.highestBid)
        : null,
      minimumAuctionAddressVIP180: minimumAuction?.addressVIP180 || null,
      minimumAuctionEndTime: minimumAuction
        ? new Date(minimumAuction.endTime)
        : null,
    };

    const [updatedToken] = await this.prisma.$transaction([
      this.prisma.tokens.upsert({
        create: tokenData,
        update: tokenData,
        where: {
          tokenId_smartContractAddress: { tokenId, smartContractAddress },
        },
      }),
      // We delete editions before inserting since some editions might have
      // been burned.
      this.prisma.editions.deleteMany({
        where: {
          smartContractAddress: token.smartContractAddress,
          tokenId: token.tokenId,
        },
      }),
      this.prisma.editions.createMany({ data: editionData }),
    ]);

    if (token.collectionId) await this.updateCollection(token.collectionId);

    if (updatedToken.version !== initialVersion) {
      throw new Error(
        `[${this.updateToken.name}] Error while updating token ${smartContractAddress}/${tokenId}: Version mismatch.`,
      );
    }

    await this.prisma.tokens.update({
      where: {
        tokenId_smartContractAddress: { smartContractAddress, tokenId },
      },
      data: { version: initialVersion + 1 },
    });

    return true;
  }

  public async updateCollection(collectionId: string): Promise<boolean> {
    const collectionExists = await this.prisma.collections
      .findUnique({ where: { collectionId } })
      .then((collection) => !!collection);

    // If the collection exists, skip the upsert
    if (collectionExists) {
      return false;
    }

    // Else get the source collection from NFT database and upsert it
    const collection = await lastValueFrom(
      this.grpcCollection.findUnique(
        encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
          where: { collectionId },
        }),
      ),
    );

    const data = {
      collectionId: collection.collectionId,
      blockchainId: collection.blockchainId,
      smartContractAddress: collection.smartContractAddress,
      creatorAddress: collection.creatorAddress,
      name: collection.name,
      customUrl: collection.customUrl,
      thumbnailImageUrl: collection.thumbnailImageUrl,
      isVerified: collection.isVerified,
      isVisible: collection.isVisible,
      type: collection.type as CollectionsType,
      importedAt: collection.importedAt,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };

    await this.prisma.collections.upsert({
      where: { collectionId: collection.collectionId },
      create: data,
      update: data,
    });

    return true;
  }

  public async updateOffer(offer: Offer) {
    const isActiveOffer =
      offer.status === 'ACTIVE' &&
      new Date(offer.endTime).getTime() > Date.now();

    let where: Prisma.TokensWhereInput;

    if (isActiveOffer) {
      // If a new offer is added we update all tokens targeted by the new offer
      // where the current highest offer is lower than the new price.

      const rates = await this.priceConversionCache.getLatestRatesByCurrency();
      const rate = rates[getPaymentFromContractAddress(offer.addressVIP180)];
      const offerPriceUsd = new BigNumber(offer.price.toString()).times(rate);
      const offerPriceVet = offerPriceUsd.dividedBy(rates['vVET']);
      const offerPriceWoV = offerPriceUsd.dividedBy(rates['WoV']);

      where = {
        smartContractAddress: offer.smartContractAddress,
        tokenId: offer.tokenId || undefined,

        OR: [
          {
            highestOfferAddressVIP180: process.env.WRAPPED_VET_CONTRACT_ADDRESS,
            highestOfferPrice: { lte: offerPriceVet.toString() },
          },
          {
            highestOfferAddressVIP180: process.env.WOV_GOVERNANCE_TOKEN_ADDRESS,
            highestOfferPrice: { lte: offerPriceWoV.toString() },
          },
          {
            highestOfferEndTime: { lt: new Date() },
          },
          {
            highestOfferEndTime: null,
          },
        ],
      };
    } else {
      // If the offer is removed we first clear it from all the tokens where
      // it was set as highest offer, then update the tokens with the next
      // highest value offer.
      where = { highestOfferId: offer.offerId };
    }

    const tokens = await this.prisma.tokens.findMany({
      where,
      select: { tokenId: true },
    });

    const highestOffers = await lastValueFrom(
      this.grpcOffer
        .findManyHighest({
          smartContractAddress: offer.smartContractAddress,
          tokenIds: tokens.map((t) => t.tokenId),
        })
        .pipe(map(({ offers }) => offers)),
    );

    if (!isActiveOffer) {
      await this.prisma.tokens.updateMany({
        where,
        data: {
          highestOfferId: null,
          highestOfferPrice: null,
          highestOfferAddressVIP180: null,
          highestOfferEndTime: null,
        },
      });
    }

    if (!highestOffers || Object.keys(highestOffers).length === 0) return;

    // Update multiple rows using the same query.
    // See https://stackoverflow.com/a/18799497

    const values = Object.entries(highestOffers)
      .map(([key, o]) => {
        const [smartContractAddress, tokenId] = key.split('_');
        return `(
          '${tokenId}',
          '${smartContractAddress}'::CITEXT,
          '${o.offerId}',
          '${formatPrice(o.price)}'::NUMERIC,
          '${o.addressVIP180}',
          '${o.endTime}'::TIMESTAMP
        )`;
      })
      .join(',');

    await this.prisma.$queryRawUnsafe(`
        UPDATE "Tokens"
        SET
          "highestOfferId"            = "Updated"."offerId",
          "highestOfferPrice"         = "Updated"."price",
          "highestOfferAddressVIP180" = "Updated"."addressVIP180",
          "highestOfferEndTime"       = "Updated"."endTime"
        FROM 
          (VALUES ${values})
          AS "Updated" (
            "tokenId", 
            "smartContractAddress",
            "offerId",
            "price",
            "addressVIP180",
            "endTime"   
          )
        WHERE
          "Tokens"."tokenId" = "Updated"."tokenId"
          AND "Tokens"."smartContractAddress" = "Updated"."smartContractAddress"
      `);
  }

  public async getTokenMedia(
    tokenId: string,
    smartContractAddress: string,
  ): Promise<any[]> {
    return await lastValueFrom(
      this.grpcImageThumbnail
        .getTokenAssets({
          tokenId,
          smartContractAddress,
        })
        .pipe(map(({ assets }) => assets)),
    );
  }

  public async updateUser(user: User) {
    const assets = await lastValueFrom(
      this.grpcImageThumbnail
        .getUserAssets({
          address: user.address,
          mediaType: UserMediaType.AVATAR,
        })
        .pipe(
          map(({ assets }) =>
            assets?.length
              ? assets
              : [
                  {
                    mimeType: 'image/*',
                    size: AssetSize.ORIGINAL,
                    url: user.profileImageUrl,
                  },
                ],
          ),
        ),
    );

    const userData = {
      name: user.name,
      customUrl: user.customUrl,
      blacklisted: user.blacklisted,
      verified: user.verified,
      verifiedLevel: user.verifiedLevel,
      assets: assets as any,
    };

    return await this.prisma.users.upsert({
      where: { address: user.address },
      create: { address: user.address, ...userData },
      update: userData,
    });
  }
}
