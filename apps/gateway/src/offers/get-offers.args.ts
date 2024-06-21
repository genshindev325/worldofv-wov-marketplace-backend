import { UserOfferType } from '@generated/ts-proto/services/offer';
import { ArgsType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';
import { PaginationArgs } from 'common/pagination.args';
import { OfferType } from './offer-type.enum';

registerEnumType(UserOfferType, { name: 'UserOfferType' });

@InputType()
export class GetOffersForUserFilters {
  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @IsString({ each: true })
  @Field(() => [String], { nullable: true, defaultValue: [] })
  tokenIds: string[];

  @IsString({ each: true })
  @Field(() => [String], { nullable: true, defaultValue: [] })
  editionIds: string[];

  @Field(() => OfferType, { nullable: true })
  type?: OfferType;
}

@ArgsType()
export class GetOffersForTokenArgs {
  @IsString()
  @Field()
  tokenId: string;

  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  acceptorAddress?: string;
}

@ArgsType()
export class GetOffersForUserArgs {
  @IsEthereumAddress()
  @Field()
  address: string;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  acceptorAddress?: string;

  @Field(() => UserOfferType)
  type: UserOfferType;

  @Field(() => GetOffersForUserFilters, { nullable: true })
  filters?: GetOffersForUserFilters;

  @Field(() => PaginationArgs)
  pagination: PaginationArgs;
}
