import { Field, ObjectType } from '@nestjs/graphql';
import { AssetDTO } from 'apps/gateway/src/common/asset.response';
import { IsArray, IsOptional } from 'class-validator';
import { MetaPagination } from '../common/meta-pagination.response';

@ObjectType()
export class MissingToken {
  @IsOptional()
  @Field()
  name: string | null;

  @IsOptional()
  @Field()
  country?: string | null;

  @IsOptional()
  @IsArray()
  @Field(() => [AssetDTO], { nullable: true })
  media?: AssetDTO[] | null;

  @IsOptional()
  @Field()
  collectionName?: string | null;

  @IsOptional()
  @Field()
  collectionThumbnail?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  collectionCustomUrl?: string | null;
}

@ObjectType()
export class GetMissingTokensResponse {
  @IsOptional()
  @IsArray()
  @Field(() => [MissingToken], { nullable: true })
  tokens?: MissingToken[] | null;

  @Field(() => MetaPagination)
  meta: MetaPagination;
}
