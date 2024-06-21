import { GetMissingTokensArgs } from '@generated/ts-proto/services/marketplace';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(private readonly prisma: PrismaClient) {}

  public async getEditionsInGraveyard(
    tokenId: string,
    smartContractAddress: string,
  ) {
    return await this.prisma.editions.count({
      where: {
        tokenId,
        smartContractAddress,
        ownerAddress: process.env.GRAVEYARD_ADDRESS,
      },
    });
  }

  public async getLastEditionUpdatedAt(
    tokenId: string,
    smartContractAddress: string,
  ) {
    return await this.prisma.editions
      .findMany({
        select: { updatedAt: true },
        where: {
          tokenId,
          smartContractAddress,
          updatedAt: { not: null },
        },
      })
      .then((editions) => editions?.sort((a, b) => b.updatedAt - a.updatedAt))
      .then((editions) => editions?.at(0)?.updatedAt || null);
  }

  public async getEditionsOnSale(
    tokenId: string,
    smartContractAddress: string,
  ) {
    return await this.prisma.editions.count({
      where: {
        tokenId,
        smartContractAddress,
        OR: [{ saleId: { not: null } }, { auctionId: { not: null } }],
      },
    });
  }

  public async getMissingTokens({
    ownerAddress,
    set,
    pagination,
  }: GetMissingTokensArgs) {
    const offset = pagination
      ? ((pagination.page || 1) - 1) * (pagination.perPage ?? 32)
      : 0;

    const limit = Math.min(Math.max(0, pagination?.perPage ?? 32), 100);
    const tokens: any[] = await this.prisma.$queryRawUnsafe(`WITH
    "tokens_for_set" AS (
        SELECT 
            "Tokens"."smartContractAddress",
            "Tokens"."tokenId",
            "Tokens"."name",
            "Tokens"."collectionId",
            "Tokens"."media",
            jsonb_path_query_first("Tokens"."attributes", '$[*] ? (@.trait_type == "Country")."value"') AS "country"
        FROM "Tokens"
        WHERE  
            "Tokens"."smartContractAddress" = '${process.env.WOW_GENESIS_CONTRACT_ADDRESS}'
            AND jsonb_path_exists("Tokens"."attributes", '$[*] ? (@.value == "Unclaimed" && @.trait_type == "${set}")') 
    ),
    "owned_countries" AS (
        SELECT DISTINCT ON("country") "country"
        FROM "tokens_for_set"
        LEFT JOIN "Editions" ON
            "tokens_for_set"."smartContractAddress" = "Editions"."smartContractAddress"
            AND "tokens_for_set"."tokenId" = "Editions"."tokenId"
        WHERE "ownerAddress" = '${ownerAddress}'
    )
    SELECT DISTINCT ON ("country")
      "tokens_for_set"."name",
      "country",
      "tokens_for_set"."media",
      "Collections"."name" as "collectionName",
      "Collections"."thumbnailImageUrl" as "collectionThumbnail",
      "Collections"."customUrl" as "collectionCustomUrl"
    FROM "tokens_for_set"
    LEFT JOIN "Collections" on
	    "tokens_for_set"."collectionId" = "Collections"."collectionId" 
    WHERE "country" NOT IN (SELECT "country" from owned_countries)
    OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `);
    const count = await this.prisma.$queryRawUnsafe<any>(`WITH
    "tokens_for_set" AS (
        SELECT 
            "Tokens"."smartContractAddress",
            "Tokens"."tokenId",
            "Tokens"."name",
            jsonb_path_query_first("Tokens"."attributes", '$[*] ? (@.trait_type == "Country")."value"') AS "country"
        FROM "Tokens"
        WHERE  
            "Tokens"."smartContractAddress" = '${process.env.WOW_GENESIS_CONTRACT_ADDRESS}'
            AND jsonb_path_exists("Tokens"."attributes", '$[*] ? (@.value == "Unclaimed" && @.trait_type == "${set}")') 
    ),
    "owned_countries" AS (
        SELECT DISTINCT ON("country") "country"
        FROM "tokens_for_set"
        LEFT JOIN "Editions" ON
            "tokens_for_set"."smartContractAddress" = "Editions"."smartContractAddress"
            AND "tokens_for_set"."tokenId" = "Editions"."tokenId"
        WHERE "ownerAddress" = '${ownerAddress}'
    )
    SELECT COUNT(DISTINCT "country")
    FROM "tokens_for_set"
    WHERE "country" NOT IN (SELECT "country" from owned_countries)
    `);
    return { tokens, count: Number(count[0].count) };
  }
}
