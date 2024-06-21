import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { AssetDTO } from '../common/asset.response';
import { MarketplaceCollection } from '../common/marketplace-collection.response';
import { MarketplaceUser } from '../common/marketplace-user.response';
import { MetaPagination } from '../common/meta-pagination.response';
import { TokensCategory } from './tokens-category.enum';

@ObjectType()
export class MarketplaceEdition {
  @Field(() => String, { nullable: false })
  smartContractAddress: string;

  @Field(() => String, { nullable: false })
  tokenId: string;

  @Field()
  editionId: string;

  @Field()
  ownerAddress: string;

  @Field({ nullable: true })
  stakingContractAddress?: string | null;

  @Field({ nullable: true })
  saleId: string | null;

  @Field({ nullable: true })
  salePrice: string | null;

  @Field({ nullable: true })
  saleAddressVIP180: string | null;

  @Field({ nullable: true })
  isFreeShipping: boolean | null;

  @Field({ nullable: true })
  cooldownEnd: number | null;

  @IsOptional()
  @Field(() => MarketplaceUser, { nullable: true })
  owner?: MarketplaceUser | null;
}

@ObjectType()
export class MarketplaceToken {
  @Field(() => String, { nullable: false })
  tokenId: string;

  @Field(() => String, { nullable: false })
  smartContractAddress: string;

  @Field(() => String, { nullable: false })
  name: string;

  @Field(() => String, { nullable: false })
  creatorAddress: string;

  @Field(() => Int, { nullable: false })
  editionsCount: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  editionsOnSale: number | null;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  editionsInGraveyard: number | null;

  @Field(() => [TokensCategory], { nullable: true })
  categories: Array<keyof typeof TokensCategory>;

  @Field(() => GraphQLJSON, { nullable: true })
  attributes: any | null;

  @Field(() => Float, { nullable: true })
  score: number | null;

  @Field(() => Int, { nullable: true })
  rank: number | null;

  @Field(() => String, { nullable: true })
  collectionId: string | null;

  @Field(() => [AssetDTO], { nullable: false })
  assets: AssetDTO[];

  @Field(() => String, { nullable: true })
  minimumSaleId: string | null;

  @Field(() => String, { nullable: true })
  minimumSalePrice: string | null;

  @Field(() => String, { nullable: true })
  maximumSalePrice: string | null;

  @Field(() => String, { nullable: true })
  minimumSaleAddressVIP180: string | null;

  @Field(() => String, { nullable: true })
  highestOfferId: string | null;

  @Field(() => String, { nullable: true })
  highestOfferPrice: string | null;

  @Field(() => String, { nullable: true })
  highestOfferAddressVIP180: string | null;

  @Field(() => Date, { nullable: true })
  highestOfferEndTime: Date | null;

  @Field(() => String, { nullable: true })
  minimumAuctionId: string | null;

  @Field(() => String, { nullable: true })
  minimumAuctionReservePrice: string | null;

  @Field(() => String, { nullable: true })
  minimumAuctionHighestBid: string | null;

  @Field(() => String, { nullable: true })
  minimumAuctionAddressVIP180: string | null;

  @Field(() => Date, { nullable: true })
  minimumAuctionEndTime: Date | null;

  @Field(() => Int, { nullable: false })
  mintedAt: number;

  @Field(() => Int, { nullable: true })
  lastListedAt: number | null;

  @Field(() => Int, { nullable: true })
  lastTransferredAt: number | null;

  @Field(() => Int, { nullable: true })
  updatedAt: number | null;

  @Field(() => String, { nullable: true })
  stakingEarnings: string | null;

  @Field(() => Int, { nullable: false, defaultValue: 0 })
  version: number;

  @IsOptional()
  @Field(() => MarketplaceUser, { nullable: true })
  creator?: MarketplaceUser | null;

  @IsOptional()
  @Field(() => MarketplaceCollection, { nullable: true })
  collection?: MarketplaceCollection | null;

  @Field(() => [MarketplaceEdition])
  editions?: MarketplaceEdition[];
}

@ObjectType()
export class GetTokensResponse {
  @Field(() => [MarketplaceToken], { nullable: true })
  items?: MarketplaceToken[] | null;

  @Field(() => MetaPagination, { nullable: true })
  meta?: MetaPagination | null;
}
