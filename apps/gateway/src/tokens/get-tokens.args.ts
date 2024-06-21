import {
  PaymentFilterEnum,
  SortTokensByEnum,
  StakedStatusEnum,
  TokenTypeFilterEnum,
  VerifiedStatusEnum,
} from '@generated/ts-proto/services/marketplace';
import { ArgsType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsEthereumAddress,
  IsInt,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationArgs } from 'common/pagination.args';
import GraphQLJSON from 'graphql-type-json';
import { TokensCategory } from './tokens-category.enum';

registerEnumType(SortTokensByEnum, { name: 'SortTokensByEnum' });
registerEnumType(VerifiedStatusEnum, { name: 'VerifiedStatusEnum' });
registerEnumType(PaymentFilterEnum, { name: 'PaymentFilterEnum' });
registerEnumType(TokenTypeFilterEnum, { name: 'TokenTypeFilterEnum' });
registerEnumType(StakedStatusEnum, { name: 'StakedStatusEnum' });

@InputType()
class GetTokensFilterArgs {
  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  onSaleOnly?: boolean | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  onAuctionOnly?: boolean | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  hideCreated?: boolean | null;

  @IsOptional()
  @IsISO8601()
  @Field({ nullable: true })
  lastListedAfter?: string | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  eligibleToStakeOnly?: boolean | null;

  @IsOptional()
  @IsEnum(StakedStatusEnum)
  @Field(() => StakedStatusEnum, { nullable: true })
  stakedStatus?: StakedStatusEnum | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  auctionsToSettleOnly?: boolean | null;

  @IsOptional()
  @IsEnum(VerifiedStatusEnum)
  @Field(() => VerifiedStatusEnum, { nullable: true })
  verifiedLevel?: VerifiedStatusEnum | null;

  @IsOptional()
  @IsEnum(PaymentFilterEnum)
  @Field(() => PaymentFilterEnum, { nullable: true })
  payment?: PaymentFilterEnum | null;

  @IsOptional()
  @IsEnum(TokensCategory)
  @Field(() => TokensCategory, { nullable: true })
  category?: TokensCategory | null;

  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  collectionId?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  smartContractAddress?: string | null;

  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  attributes?: { [k: string]: any } | null;

  @IsOptional()
  @IsEnum(TokenTypeFilterEnum)
  @Field(() => TokenTypeFilterEnum, { nullable: true })
  typeFilter?: TokenTypeFilterEnum | null;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  query?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  ownerAddress?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  creatorAddress?: string | null;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @Field({ nullable: true })
  minPrice?: string | null;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @Field({ nullable: true })
  maxPrice?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field({ nullable: true })
  minRank?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field({ nullable: true })
  maxRank?: number | null;
}

@ArgsType()
export class GetTokensArgs {
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationArgs)
  @Field(() => PaginationArgs, { nullable: true })
  pagination?: PaginationArgs | null;

  @ValidateNested()
  @Type(() => GetTokensFilterArgs)
  @Field(() => GetTokensFilterArgs, { nullable: true })
  filters?: GetTokensFilterArgs | null;

  @IsOptional()
  @IsEnum(SortTokensByEnum)
  @Field(() => SortTokensByEnum, { nullable: true })
  sortBy?: SortTokensByEnum;
}
