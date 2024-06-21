import {
  Field,
  ID,
  Int,
  NullableList,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuctionStatus } from '@prisma/client/auction';
import { User } from 'apps/gateway/src/user/user.response';
import { IsOptional } from 'class-validator';
import { AggregatedToken } from './aggregated-token.response';

registerEnumType(AuctionStatus, { name: 'AuctionStatus' });

@ObjectType()
export class GetAuctionResponse {
  @Field(() => ID, { nullable: false })
  auctionId: string;

  @Field(() => String, { nullable: false })
  tokenId: string;

  @Field(() => String, { nullable: false })
  editionId: string;

  @Field(() => String, { nullable: false })
  smartContractAddress: string;

  @Field(() => String, { nullable: false })
  sellerAddress: string;

  @Field(() => String, { nullable: true })
  settlorAddress?: string | null;

  @Field(() => String, { nullable: true })
  highestBidderAddress?: string | null;

  @Field(() => String, { nullable: false })
  reservePrice: string;

  @Field(() => String, { nullable: true })
  highestBid?: string | null;

  @Field(() => String, { nullable: true })
  addressVIP180?: string | null;

  @Field(() => Date, { nullable: false })
  startingTime: Date;

  @Field(() => Date, { nullable: false })
  endTime: Date;

  @Field(() => AuctionStatus, { nullable: false, defaultValue: 'UNKNOWN' })
  status: keyof typeof AuctionStatus;

  @Field(() => Int, { nullable: true })
  createdAt?: number | null;

  @Field(() => Int, { nullable: true })
  updatedAt?: number | null;

  @IsOptional()
  @Field(() => User, { nullable: true })
  seller?: User | null;

  @IsOptional()
  @Field(() => AggregatedToken, { nullable: true })
  token?: AggregatedToken | NullableList;
}
