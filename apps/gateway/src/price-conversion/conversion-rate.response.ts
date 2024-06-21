import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ConversionRate {
  @Field()
  currency: string;

  @Field()
  priceUSD: number;

  @Field()
  updatedAt: string;
}
