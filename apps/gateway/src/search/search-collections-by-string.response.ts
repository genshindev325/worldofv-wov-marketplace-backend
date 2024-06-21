import { Field, ObjectType } from '@nestjs/graphql';
import { IsArray, IsOptional } from 'class-validator';
import { SearchCollectionResponse } from './search-by-string.response';

@ObjectType()
export class SearchCollectionsByStringResponse {
  @IsOptional()
  @IsArray()
  @Field(() => [SearchCollectionResponse], { nullable: true })
  collections?: SearchCollectionResponse[] | null;
}
