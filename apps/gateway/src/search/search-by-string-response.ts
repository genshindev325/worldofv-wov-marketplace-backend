import { Field, ObjectType } from '@nestjs/graphql';
import { IsArray, IsOptional } from 'class-validator';
import { User } from '../user/user.response';
import { SearchCollectionResponse } from './search-by-string.response';

@ObjectType()
export class SearchCollection {
  @Field()
  isVerified: boolean;
}

@ObjectType()
export class SearchTokenResponse {
  @Field()
  tokenId: string;

  @Field()
  smartContractAddress: string;

  @Field()
  name: string;

  @Field()
  collection: SearchCollection;
}

@ObjectType()
class Asset {
  @Field()
  url: string;

  @Field()
  mimeType: string;
}

@ObjectType()
class TokenWithAsset extends SearchTokenResponse {
  @Field()
  asset: Asset;
}

@ObjectType()
export class SearchByStringResponse {
  @IsOptional()
  @IsArray()
  @Field(() => [SearchCollectionResponse], { nullable: true })
  collections?: SearchCollectionResponse[] | null;

  @IsOptional()
  @IsArray()
  @Field(() => [TokenWithAsset], { nullable: true })
  tokens?: TokenWithAsset[] | null;

  @IsOptional()
  @IsArray()
  @Field(() => [User], { nullable: true })
  users?: User[] | null;
}
