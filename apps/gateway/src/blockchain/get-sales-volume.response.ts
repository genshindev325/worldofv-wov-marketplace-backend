import { Field, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsEthereumAddress, IsOptional } from 'class-validator';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';

@ObjectType()
export class GetSalesVolumeTotalObject {
  @IsOptional()
  @Field({ nullable: true })
  payment?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  addressVIP180?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  value?: string | null;

  @IsOptional()
  @Field(() => GraphQLDecimal, { nullable: true })
  asWei?: string | null;
}

@ObjectType()
export class GetSalesVolumeTransactionsObject {
  @Field(() => Int)
  count: number;

  @IsOptional()
  @IsArray()
  @Field(() => [String], { nullable: true })
  list?: string[] | null;
}

@ObjectType()
export class GetSalesVolumeGenericObject {
  @IsOptional()
  @IsArray()
  @Field(() => [GetSalesVolumeTotalObject], { nullable: true })
  total?: GetSalesVolumeTotalObject[] | null;

  @IsOptional()
  @Field(() => GetSalesVolumeTransactionsObject, { nullable: true })
  transactions?: GetSalesVolumeTransactionsObject | null;
}

@ObjectType()
export class GetSalesVolumeResult {
  @Field(() => GetSalesVolumeGenericObject)
  sales: GetSalesVolumeGenericObject;

  @Field(() => GetSalesVolumeGenericObject)
  offers: GetSalesVolumeGenericObject;

  @Field(() => GetSalesVolumeGenericObject)
  auctions: GetSalesVolumeGenericObject;
}
