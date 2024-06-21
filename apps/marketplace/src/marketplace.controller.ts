import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheService } from '@app/price-conversion-cache';
import { Web3Service } from '@app/web3';
import {
  FindOneTokenArgs,
  GetCollectionsArgs,
  GetMissingTokensArgs,
  GetTokensArgs,
  MarketplaceServiceController,
  MarketplaceServiceControllerMethods,
  PaymentFilterEnum,
  SortTokensByEnum,
  StakedStatusEnum,
  TokenTypeFilterEnum,
  VerifiedStatusEnum,
} from '@generated/ts-proto/services/marketplace';
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
import { AssetSize } from '@generated/ts-proto/types/asset';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/marketplace';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { getCombinations } from 'common/combinations.helper';
import { formatObjectDotNotation } from 'common/format-object-dot-notation';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import { MarketplaceService } from './marketplace.service';
const knexPg = knex({ client: 'pg' });

const selectWithPrefix = (
  tableName: string,
  prefix: string,
  columns: string[],
) => {
  return columns.map(
    (column) => `${tableName}.${column} AS ${prefix}.${column}`,
  );
};

@Controller()
@MarketplaceServiceControllerMethods()
export class MarketplaceController
  implements OnModuleInit, MarketplaceServiceController
{
  private readonly logger = new Logger(MarketplaceController.name);

  private grpcUser: UserServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    private readonly web3Service: Web3Service,
    private readonly prisma: PrismaClient,
    private readonly marketplaceService: MarketplaceService,
    private readonly priceConversionCache: PriceConversionCacheService,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);

    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);

    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);

    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  async getTokens(args: GetTokensArgs, metadata: Metadata) {
    const page = args?.pagination?.page || 1;
    const perPage = args?.pagination?.perPage || 0;
    const offset = (page - 1) * perPage;
    const limit = offset + perPage;

    const userAddress = metadata.get('user_address')?.[0];
    const isAdmin = metadata.get('is_admin')?.[0] === 'true';

    const baseQuery = knexPg
      .from('Tokens')
      .leftJoin('Users', 'Tokens.creatorAddress', 'Users.address')
      .leftJoin(
        'Collections',
        'Tokens.collectionId',
        'Collections.collectionId',
      )
      // Filter out NFTs in graveyard
      .where('editionsInGraveyard', 0)
      // Private collection
      .where((builder) => {
        // The admin can show any private collection
        if (isAdmin) return;

        // Hide private collections to the users
        builder
          .where('Collections.isVisible', true)
          .orWhereNull('Collections.isVisible');

        // The creator can show his tokens too if it’s private
        if (userAddress) {
          builder.orWhere('Collections.creatorAddress', userAddress);
        }
      })
      // On Sale
      .where((builder) => {
        if (args.filters.onSaleOnly) {
          builder.whereNotNull('minimumSaleId').orWhere((auctionBuilder) => {
            auctionBuilder
              .whereNotNull('minimumAuctionId')
              .andWhere('minimumAuctionEndTime', '>', 'now()');
          });
        }
      })
      // On Auction
      .where((builder) => {
        if (args.filters.onAuctionOnly) {
          builder.whereNotNull('minimumAuctionId');

          if (args.filters.auctionsToSettleOnly) {
            builder.andWhere('minimumAuctionEndTime', '<', 'now()');
          } else {
            builder.andWhere('minimumAuctionEndTime', '>', 'now()');
          }
        }
      })
      // Payment/Crypto type
      .where((builder) => {
        switch (args.filters.payment) {
          case PaymentFilterEnum.VET:
            builder
              .whereNull('minimumSaleAddressVIP180')
              .whereNull('minimumAuctionAddressVIP180');
            break;
          case PaymentFilterEnum.WoV:
            builder
              .where(
                'minimumSaleAddressVIP180',
                process.env.WOV_GOVERNANCE_TOKEN_ADDRESS,
              )
              .orWhere(
                'minimumAuctionAddressVIP180',
                process.env.WOV_GOVERNANCE_TOKEN_ADDRESS,
              );
            break;
        }
      })
      // VerifiedLevel
      .where((builder) => {
        switch (args.filters.verifiedLevel) {
          case VerifiedStatusEnum.VERIFIED_AND_CURATOR:
            builder
              .where('Users.verified', true)
              .orWhere('Collections.isVerified', true);
            break;
          case VerifiedStatusEnum.CURATOR:
            builder
              .where('Users.verified', true)
              .andWhere('Users.verifiedLevel', 'CURATED');
            break;
          case VerifiedStatusEnum.VERIFIED:
            builder
              .where('Users.verified', true)
              .andWhere('Users.verifiedLevel', 'VERIFIED')
              .orWhere('Collections.isVerified', true);
            break;
        }
      })
      // Category
      .where((builder) => {
        if (args.filters.category) {
          builder.whereRaw(
            '? = ANY("Tokens"."categories")',
            args.filters.category,
          );
        }
      })
      // Blacklisted user
      .where((builder) => {
        builder
          .where('Users.blacklisted', false)
          .orWhereNull('Users.blacklisted');
      })
      // Collection
      .where((builder) => {
        if (args.filters.collectionId) {
          builder
            .where('Tokens.collectionId', args.filters.collectionId)
            .orWhere('Collections.blockchainId', args.filters.collectionId);
        } else if (args.filters.smartContractAddress) {
          builder.where(
            'Tokens.smartContractAddress',
            args.filters.smartContractAddress,
          );
        }
      })
      // Attributes
      .where((builder) => {
        if (args.filters?.attributes) {
          const attributes = JSON.parse(args.filters.attributes);
          const combinations = getCombinations(attributes);

          for (const combination of combinations) {
            const filterArray = Object.entries(combination).reduce(
              (acc, [trait_type, value]) => [...acc, { trait_type, value }],
              [],
            );

            const jsonAttributes = JSON.stringify(filterArray);

            builder.orWhereRaw(
              `"Tokens"."attributes" @> ?::jsonb`,
              jsonAttributes,
            );
          }
        }
      })
      // TokenType (Artists/PFP)
      .where((builder) => {
        switch (args.filters.typeFilter) {
          case TokenTypeFilterEnum.PFP:
            builder.whereNot(
              'Tokens.smartContractAddress',
              process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
            );
            break;
          case TokenTypeFilterEnum.ARTIST:
            builder.where(
              'Tokens.smartContractAddress',
              process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
            );
            break;
        }
      })
      // Query search
      .where((builder) => {
        if (args.filters.query) {
          builder
            .whereILike('Tokens.name', `%${args.filters.query}%`)
            .orWhereILike('Users.name', `%${args.filters.query}%`)
            .orWhereILike('Collections.name', `%${args.filters.query}%`);
        }
      })
      // Created
      .where((builder) => {
        if (args.filters.creatorAddress) {
          builder.where('Tokens.creatorAddress', args.filters.creatorAddress);
        }
      })
      // Rank
      .where((builder) => {
        if (args.filters.minRank) {
          builder.where('Tokens.rank', '>=', args.filters.minRank);
        }
        if (args.filters.maxRank) {
          builder.where('Tokens.rank', '<=', args.filters.maxRank);
        }
      })
      // Price
      .where((builder) => {
        if (args.filters.minPrice) {
          builder.where('Tokens.maximumSalePrice', '>=', args.filters.minPrice);
        }
        if (args.filters.maxPrice) {
          builder.where('Tokens.minimumSalePrice', '<=', args.filters.maxPrice);
        }
      })
      // Staking
      .where((builder) => {
        if (args.filters.eligibleToStakeOnly) {
          builder
            .where('Tokens.stakingEarnings', '!=', '0')
            .orWhereNull('Tokens.stakingEarnings');
        }
      })
      // Hide Created
      .where((builder) => {
        if (args.filters?.hideCreated && args.filters?.ownerAddress) {
          builder.whereNot('Tokens.creatorAddress', args.filters.ownerAddress);
        }
      });

    // Listed after
    if (args.filters?.lastListedAfter) {
      const timestamp = new Date(args.filters.lastListedAfter).getTime() / 1000;
      const fromBlock = await this.web3Service.getBlockNumberFromTimestamp(
        timestamp,
      );
      baseQuery.where('Tokens.lastListedAt', '>=', fromBlock);
    }

    // OwnedBy and stakedStatus
    // Joining the prefiltered editions is faster than joining and filtering
    // in the main query. This method also allows us to join on demand.
    if (args.filters?.ownerAddress || args.filters?.stakedStatus) {
      const filterEditions = knexPg
        .select(
          'tokenId',
          'smartContractAddress',
          knexPg.raw('MAX("lastListedAt") AS "lastListedAt"'),
          knexPg.raw('MAX("lastTransferredAt") AS "lastTransferredAt"'),
        )
        .from('Editions')
        .where((builder) => {
          if (args.filters.ownerAddress) {
            builder.where('ownerAddress', args.filters.ownerAddress);
          }

          if (args.filters.stakedStatus === StakedStatusEnum.Staked) {
            builder.whereNotNull('Editions.stakingContractAddress');
          }

          if (args.filters.stakedStatus === StakedStatusEnum.Unstaked) {
            builder.whereNull('Editions.stakingContractAddress');
          }

          if (args.filters.onSaleOnly) {
            builder.where((saleBuilder) => {
              saleBuilder.whereNotNull('saleId').orWhere((auctionBuilder) => {
                auctionBuilder
                  .whereNotNull('auctionId')
                  .andWhere('auctionEndTime', '>', 'now()');
              });
            });
          }

          if (args.filters.onAuctionOnly) {
            builder.whereNotNull('auctionId');

            if (args.filters.auctionsToSettleOnly) {
              builder.andWhere('auctionEndTime', '<', 'now()');
            } else {
              builder.andWhere('auctionEndTime', '>', 'now()');
            }
          }
        })
        .groupBy(['tokenId', 'smartContractAddress'])
        .as('FilterEditions');

      baseQuery.innerJoin(filterEditions, (builder) =>
        builder
          .on('Tokens.tokenId', 'FilterEditions.tokenId')
          .andOn(
            'Tokens.smartContractAddress',
            'FilterEditions.smartContractAddress',
          ),
      );
    }

    const itemsQuery = baseQuery
      .clone()
      .select(
        'Tokens.*',

        ...selectWithPrefix('Users', 'creator', [
          'address',
          'name',
          'customUrl',
          'blacklisted',
          'verified',
          'verifiedLevel',
          'assets',
        ]),

        ...selectWithPrefix('Collections', 'collection', [
          'collectionId',
          'blockchainId',
          'smartContractAddress',
          'creatorAddress',
          'name',
          'customUrl',
          'thumbnailImageUrl',
          'isVerified',
          'isVisible',
          'type',
          'importedAt',
        ]),
      )
      .offset(offset)
      .limit(limit);

    // OrderBy
    if (args.sortBy) {
      let sortOrder: 'asc' | 'desc';
      let sortKey: string;

      switch (args.sortBy) {
        case SortTokensByEnum.PRICE_HIGH_TO_LOW:
        case SortTokensByEnum.OFFER_HIGH_TO_LOW:
        case SortTokensByEnum.ID_HIGH_TO_LOW:
        case SortTokensByEnum.RARITY_LOW_TO_HIGH:
        case SortTokensByEnum.ALPHABETICAL_DESC:
        case SortTokensByEnum.NEWEST_CREATION:
        case SortTokensByEnum.NEWEST_UPDATE:
        case SortTokensByEnum.NEWEST_TRANSFER:
        case SortTokensByEnum.NEWEST_LISTING:
          sortOrder = 'desc';
          break;
        default:
          sortOrder = 'asc';
      }

      const rates = await this.priceConversionCache.getLatestRatesByCurrency();

      switch (args.sortBy) {
        case SortTokensByEnum.PRICE_HIGH_TO_LOW:
        case SortTokensByEnum.PRICE_LOW_TO_HIGH:
          sortKey = `GREATEST(
            CASE 
              WHEN "Tokens"."minimumSaleAddressVIP180" IS NULL
              THEN "Tokens"."minimumSalePrice" * ${rates['VET']}
              ELSE "Tokens"."minimumSalePrice" * ${rates['WoV']} 
            END, 

            CASE 
              WHEN "Tokens"."minimumAuctionAddressVIP180" IS NULL
              THEN "Tokens"."minimumAuctionHighestBid" * ${rates['VET']}
              ELSE "Tokens"."minimumAuctionHighestBid" * ${rates['WoV']} 
            END, 

            CASE 
              WHEN "Tokens"."minimumAuctionAddressVIP180" IS NULL
              THEN "Tokens"."minimumAuctionReservePrice" * ${rates['VET']}
              ELSE "Tokens"."minimumAuctionReservePrice" * ${rates['WoV']} 
            END
          )`;
          break;

        case SortTokensByEnum.OFFER_HIGH_TO_LOW:
        case SortTokensByEnum.OFFER_LOW_TO_HIGH:
          sortKey = `(
            CASE 
              WHEN "Tokens"."highestOfferAddressVIP180" = '${process.env.WRAPPED_VET_CONTRACT_ADDRESS}'
              THEN "Tokens"."highestOfferPrice" * ${rates['vVET']}
              ELSE "Tokens"."highestOfferPrice" * ${rates['WoV']}
            END
          )`;
          break;

        case SortTokensByEnum.AUCTION_ENDING_SOON:
          sortKey = '"Tokens"."minimumAuctionEndTime"';
          break;

        case SortTokensByEnum.NEWEST_CREATION:
        case SortTokensByEnum.OLDEST_CREATION:
          sortKey = '"Tokens"."mintedAt"';
          break;

        case SortTokensByEnum.NEWEST_UPDATE:
        case SortTokensByEnum.OLDEST_UPDATE:
          sortKey = '"Tokens"."updatedAt"';
          break;

        // When sorting by transfer or listing time we want to consider only the
        // editions owned by the current owner (if specified).

        case SortTokensByEnum.NEWEST_TRANSFER:
        case SortTokensByEnum.OLDEST_TRANSFER:
          if (args?.filters?.ownerAddress) {
            sortKey = `"FilterEditions"."lastTransferredAt"`;
          } else {
            sortKey = `"Tokens"."lastTransferredAt"`;
          }
          break;

        case SortTokensByEnum.NEWEST_LISTING:
        case SortTokensByEnum.OLDEST_LISTING:
          if (args?.filters?.ownerAddress) {
            sortKey = `"FilterEditions"."lastListedAt"`;
          } else {
            sortKey = `"Tokens"."lastListedAt"`;
          }
          break;

        case SortTokensByEnum.ID_HIGH_TO_LOW:
        case SortTokensByEnum.ID_LOW_TO_HIGH:
          sortKey = 'cast("Tokens"."tokenId" as int)';
          break;

        case SortTokensByEnum.RARITY_HIGH_TO_LOW:
        case SortTokensByEnum.RARITY_LOW_TO_HIGH:
          sortKey = '"Tokens"."rank"';
          break;

        case SortTokensByEnum.ALPHABETICAL_DESC:
        case SortTokensByEnum.ALPHABETICAL_ASC:
          sortKey = '"Tokens"."name"';
      }

      itemsQuery.orderByRaw(`${sortKey} ${sortOrder} NULLS LAST`);
    }

    // The rows must be always sorted in a deterministic order to avoid issues with pagination.
    itemsQuery.orderBy(['Tokens.tokenId', 'Tokens.smartContractAddress']);

    // Apparently the count is faster when using a nested select distinct
    // instead of using a count distinct directly, no idea why.
    let countQuery = baseQuery
      .clone()
      .select(
        knexPg.raw(
          'DISTINCT "Tokens"."tokenId", "Tokens"."smartContractAddress"',
        ),
      )
      .as('tokens');

    countQuery = knexPg.select(knexPg.raw('COUNT(*)')).from(countQuery);

    const [itemsResponse, countResponse] = await Promise.all([
      limit !== 0
        ? this.prisma.$queryRawUnsafe<any>(itemsQuery.toString())
        : [],
      this.prisma.$queryRawUnsafe<any>(countQuery.toString()),
    ]);

    // We fetch the editions in a separate query so we can avoid a group by
    // clause in the main query, allowing us to use indexes for sorting.
    const editions = await this.prisma.editions.findMany({
      where: {
        OR: itemsResponse.map((t: any) =>
          _.pick(t, ['smartContractAddress', 'tokenId']),
        ),
      },
    });

    const editionsByTokenId = _.groupBy(
      editions,
      (e) => `${e.smartContractAddress}_${e.tokenId}`,
    );

    const items = itemsResponse.slice(0, perPage).map((data: any) => {
      const item: any = formatObjectDotNotation(data);

      const editionsKey = `${item.smartContractAddress}_${item.tokenId}`;
      item.editions = editionsByTokenId[editionsKey];

      if (!item.creator?.address) {
        item.creator = null;
      }

      if (!item.collection?.collectionId) {
        item.collection = null;
      }

      item.assets = item.media;

      item.importedAt = item.importedAt?.toISOString();

      return item;
    });

    const total = Number(countResponse[0].count);

    return {
      items,
      meta: {
        total,
        hasMore: total > offset + limit,
      },
    };
  }

  async getCollections(args: GetCollectionsArgs, metadata: Metadata) {
    const userAddress = metadata.get('user_address')?.[0];
    const isAdmin = metadata.get('is_admin')?.[0] === 'true';

    const offset = args.pagination
      ? ((args.pagination.page || 1) - 1) * (args.pagination.perPage ?? 32)
      : 0;

    const limit = Math.min(Math.max(0, args.pagination?.perPage ?? 32), 100);

    const query = knexPg
      .from('Collections')
      .select([
        'Collections.*',
        ...selectWithPrefix('Users', 'creator', [
          'address',
          'name',
          'customUrl',
          'assets',
          'blacklisted',
          'verified',
          'verifiedLevel',
        ]),
      ])
      .leftJoin('Users', 'Collections.creatorAddress', 'Users.address')
      .where('Collections.creatorAddress', args.filters.creatorAddress)
      // Private collection
      .where((builder) => {
        // The admin can show any private collection
        if (isAdmin) return;

        // Hide private collections to the users
        builder
          .where('Collections.isVisible', true)
          .orWhereNull('Collections.isVisible');

        // The creator can show his tokens too if it’s private
        if (userAddress) {
          builder.orWhere('Collections.creatorAddress', userAddress);
        }
      })
      .orderBy('createdAt', 'desc', 'last')
      .offset(offset)
      .limit(limit);

    const countQuery = query
      .clone()
      .clearSelect()
      .select(knexPg.raw('COUNT(*) OVER()'))
      .limit(1)
      .offset(0);

    const [total, items] = await Promise.all([
      this.prisma
        .$queryRawUnsafe<any>(countQuery.toString())
        .then((res) => (res.length ? res[0].count : 0)),

      args.pagination?.perPage === 0
        ? []
        : this.prisma.$queryRawUnsafe<any>(query.toString()).then((items) =>
            items.map((item: any) => {
              const obj: any = formatObjectDotNotation(item);

              if (!obj.creator?.address) {
                obj.creator = null;
              }

              return obj;
            }),
          ),
    ]);

    return {
      items,
      meta: {
        total: Number(total),
        hasMore: total > offset + items?.length,
      },
    };
  }

  async getToken(args: FindOneTokenArgs) {
    const token = await lastValueFrom(
      this.grpcToken.findUnique(
        encodeSerializedJson<PrismaNft.TokenFindUniqueArgs>({
          where: {
            tokenId_smartContractAddress: {
              tokenId: args.tokenId,
              smartContractAddress: args.smartContractAddress,
            },
          },
        }),
      ),
    );

    if (!token) return null;

    const collection = token.collectionId
      ? await lastValueFrom(
          this.grpcCollection
            .findUnique(
              encodeSerializedJson<PrismaNft.CollectionFindUniqueArgs>({
                where: { collectionId: token.collectionId },
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
        )
      : null;

    const [assets, user] = await Promise.all([
      // Image Thumbnails
      lastValueFrom(
        this.grpcImageThumbnail
          .getTokenAssets({
            tokenId: args.tokenId,
            smartContractAddress: args.smartContractAddress,
          })
          .pipe(
            map((media) => media.assets),
            catchError((err) => {
              this.logger.error(err);
              return of([
                {
                  size: AssetSize.ORIGINAL,
                  mimeType: token.imageMimeType,
                  url: token.imageUrl,
                },
              ]);
            }),
          ),
      ),

      // User - Creator
      token.creatorAddress
        ? lastValueFrom(
            this.grpcUser
              .findUnique(
                encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
                  where: { address: token.creatorAddress },
                }),
              )
              .pipe(
                catchError((err) => {
                  if (err?.code === GrpcStatus.NOT_FOUND) {
                    return of({ address: token.creatorAddress });
                  } else {
                    return throwError(() => err);
                  }
                }),
              ),
          )
        : null,
    ]);

    return {
      ...token,
      creator: user,
      collection,
      assets,
      editionsOnSale: 0,
    };
  }

  async getEditions(args: FindOneTokenArgs) {
    const query = knexPg
      .select([
        'Editions.*',
        ...selectWithPrefix('Users', 'owner', [
          'address',
          'name',
          'customUrl',
          'assets',
          'blacklisted',
          'verified',
          'verifiedLevel',
        ]),
      ])
      .from('Editions')
      .leftJoin('Users', 'Editions.ownerAddress', 'Users.address')
      .where('Editions.tokenId', args.tokenId)
      .andWhere('Editions.smartContractAddress', args.smartContractAddress)
      .orderBy('Editions.editionId', 'asc', 'last')
      .toString();

    const items = await this.prisma.$queryRawUnsafe<any>(query).then((items) =>
      items.map((item: any) => {
        const obj: any = formatObjectDotNotation(item);

        if (!obj.owner?.address) {
          obj.owner = { address: obj.ownerAddress };
        }

        return obj;
      }),
    );

    return { items };
  }

  async getSaleIds(): Promise<{ saleIds: string[] }> {
    return await this.prisma.editions
      .findMany({
        select: { saleId: true },
        where: { saleId: { not: null } },
      })
      .then((sales) => ({ saleIds: sales.map((sale) => sale.saleId) }));
  }

  async getMissingTokens({
    ownerAddress,
    set,
    pagination,
  }: GetMissingTokensArgs): Promise<any> {
    const response = await this.marketplaceService.getMissingTokens({
      ownerAddress,
      set,
      pagination,
    });
    const offset = pagination
      ? ((pagination.page || 1) - 1) * (pagination.perPage ?? 32)
      : 0;

    const tokens = response.tokens;
    const total = response.count;
    const hasMore = tokens ? total > offset + tokens.length : false;

    return {
      tokens,
      meta: {
        total,
        hasMore,
      },
    };
  }
}
