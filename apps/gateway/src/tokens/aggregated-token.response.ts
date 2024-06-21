import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { CollectionDTO } from 'apps/gateway/src/collections/collection.response';
import { AssetDTO } from 'apps/gateway/src/common/asset.response';
import { User } from 'apps/gateway/src/user/user.response';
import { IsOptional } from 'class-validator';
import { TokenDTO } from './token.response';

@ArgsType()
@ObjectType()
export class AggregatedToken extends TokenDTO {
  @IsOptional()
  @Field(() => User, { nullable: true })
  creator?: User | null;

  @IsOptional()
  @Field(() => CollectionDTO, { nullable: true })
  collection?: CollectionDTO | null;

  @IsOptional()
  @Field(() => [AssetDTO])
  assets: AssetDTO[];
}
