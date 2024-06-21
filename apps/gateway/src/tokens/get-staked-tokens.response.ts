import { Field, ObjectType } from '@nestjs/graphql';
import {
  IsArray,
  IsEthereumAddress,
  IsOptional,
  IsString,
} from 'class-validator';

@ObjectType()
export class StakedToken {
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
  stakingContractAddress: string;
}

@ObjectType()
export class GetStakedTokensResponse {
  @IsOptional()
  @IsArray()
  @Field(() => [StakedToken], { nullable: true })
  items?: StakedToken[] | null;
}
