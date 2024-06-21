import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AssetDTO } from 'apps/gateway/src/common/asset.response';
import { User } from 'apps/gateway/src/user/user.response';
import { CollectionDTO } from '../collections/collection.response';
import { TokenDTO } from '../tokens/token.response';

@ObjectType()
export class VerifiedDrop {
  @Field()
  id: string;

  @Field(() => Int)
  position: number;

  @Field()
  dateTime: string;

  @Field({ nullable: true })
  imageUrl?: string | null;

  @Field({ nullable: true })
  title?: string | null;

  @Field({ nullable: true })
  address?: string | null;

  @Field({ nullable: true })
  collectionId?: string | null;

  @Field({ nullable: true })
  tokenId?: string | null;

  @Field(() => User, { nullable: true })
  artist?: User | null;

  @Field(() => CollectionDTO, { nullable: true })
  collection?: CollectionDTO | null;

  @Field(() => TokenDTO, { nullable: true })
  token?: TokenDTO | null;

  @Field(() => AssetDTO, { nullable: true })
  asset?: AssetDTO | null;
}
