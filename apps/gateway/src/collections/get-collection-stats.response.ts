import { Field, Int, ObjectType } from '@nestjs/graphql';
import { HighestOfferDTO } from 'apps/gateway/src/offers/offer.response';
import { IsEthereumAddress, IsOptional, IsPositive } from 'class-validator';

@ObjectType()
class Price {
  @IsOptional()
  @Field({ nullable: true })
  price?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  addressVIP180?: string | null;
}

@ObjectType()
export class GetCollectionStatsResponse {
  @IsOptional()
  @IsPositive()
  @Field(() => Int, { nullable: true })
  itemsCount?: number | null;

  @IsOptional()
  @IsPositive()
  @Field(() => Int, { nullable: true })
  ownersCount?: number | null;

  @IsOptional()
  @Field(() => [Price], { nullable: true })
  floorPrices?: Price[] | null;

  @IsOptional()
  @IsPositive()
  @Field(() => Int, { nullable: true })
  offersCount?: number | null;

  @IsOptional()
  @Field(() => HighestOfferDTO, { nullable: true })
  highestCollectionOffer?: HighestOfferDTO | null;
}
