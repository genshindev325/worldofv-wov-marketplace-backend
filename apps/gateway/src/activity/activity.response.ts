import { ActivityEventKind } from '@generated/ts-proto/services/activity';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AssetDTO } from 'apps/gateway/src/common/asset.response';
import { User } from 'apps/gateway/src/user/user.response';
import { CollectionDTO } from '../collections/collection.response';
import { TokenDTO } from '../tokens/token.response';

registerEnumType(ActivityEventKind, { name: 'ActivityEventKind' });

@ObjectType()
export class ActivityEvent {
  @Field(() => ActivityEventKind)
  event: ActivityEventKind;

  @Field()
  dateTime: string;

  @Field({ nullable: true })
  resourceId?: string | null;

  @Field({ nullable: true })
  smartContractAddress?: string | null;

  @Field({ nullable: true })
  tokenId?: string | null;

  @Field({ nullable: true })
  editionId?: string | null;

  @Field({ nullable: true })
  price?: string | null;

  @Field({ nullable: true })
  payment?: string | null;

  @Field({ nullable: true })
  fromAddress?: string | null;

  @Field({ nullable: true })
  toAddress?: string | null;

  @Field(() => CollectionDTO, { nullable: true })
  collection?: CollectionDTO | null;

  @Field(() => TokenDTO, { nullable: true })
  token?: TokenDTO | null;

  @Field(() => User, { nullable: true })
  fromUser?: User | null;

  @Field(() => User, { nullable: true })
  toUser?: User | null;

  @Field(() => AssetDTO, { nullable: true })
  asset?: AssetDTO | null;
}

@ObjectType()
export class GetActivityResponse {
  @Field()
  hasMore: boolean;

  @Field(() => [ActivityEvent], { nullable: true })
  events?: ActivityEvent[] | null;
}
