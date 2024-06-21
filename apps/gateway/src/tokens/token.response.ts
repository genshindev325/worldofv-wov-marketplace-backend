import { TokenAttribute } from '@generated/ts-proto/types/token';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { TokensCategory } from './tokens-category.enum';

registerEnumType(TokensCategory, { name: 'TokenCategory' });

@ObjectType()
export class TokenDTO {
  @Field()
  tokenId: string;

  @Field()
  smartContractAddress: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description: string | null;

  @Field()
  creatorAddress: string;

  @Field()
  editionsCount: number;

  @Field()
  royalty: number;

  @Field(() => [TokensCategory], { nullable: true })
  categories?: Array<keyof typeof TokensCategory> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  attributes: TokenAttribute[] | null;

  @Field({ nullable: true })
  score?: number;

  @Field({ nullable: true })
  rank: number | null;

  @Field({ nullable: true })
  collectionId?: string | null;

  @Field()
  mintedAt: number;

  @Field({ nullable: true })
  stakingEarnings?: string | null;
}
