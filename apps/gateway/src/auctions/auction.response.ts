import {
  ArgsType,
  Field,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Prisma } from '@prisma/client/auction';
import {
  IsEnum,
  IsEthereumAddress,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';

export enum AuctionStatus {
  UNKNOWN = 'UNKNOWN',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  TO_SETTLE = 'TO_SETTLE',
  SETTLED = 'SETTLED',
}

registerEnumType(AuctionStatus, {
  name: 'AuctionStatus',
  description: undefined,
});

@ArgsType()
@ObjectType()
export class AuctionDTO {
  @IsString()
  @Field()
  auctionId: string;

  @IsString()
  @Field()
  tokenId: string;

  @IsString()
  @Field()
  editionId: string;

  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @IsEthereumAddress()
  @Field()
  sellerAddress: string;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  settlorAddress?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  highestBidderAddress?: string | null;

  @Field(() => GraphQLDecimal)
  reservePrice: Prisma.Decimal | number | string;

  @IsOptional()
  @Field(() => GraphQLDecimal, { nullable: true })
  highestBid: Prisma.Decimal | number | string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  addressVIP180?: string | null;

  @IsNumberString()
  @Field(() => Date)
  startingTime: Date | string;

  @IsNumberString()
  @Field(() => Date)
  endTime: Date | string;

  @IsEnum(AuctionStatus)
  @Field(() => AuctionStatus, { defaultValue: AuctionStatus.UNKNOWN })
  status?: AuctionStatus;

  @IsOptional()
  @IsPositive()
  @Field(() => Int)
  createdAt?: number | null;

  @IsOptional()
  @IsPositive()
  @Field(() => Int)
  updatedAt?: number | null;
}
