import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CollectionsType } from '@prisma/client/marketplace';
import { MarketplaceUser } from './marketplace-user.response';

registerEnumType(CollectionsType, { name: 'CollectionsType' });

@ObjectType()
export class MarketplaceCollection {
  @Field(() => ID, { nullable: false })
  collectionId: string;

  @Field(() => String, { nullable: true })
  blockchainId?: string;

  @Field(() => String, { nullable: true })
  smartContractAddress?: string;

  @Field(() => [String], { nullable: true })
  stakingContractAddresses: Array<string>;

  @Field(() => String, { nullable: true })
  creatorAddress?: string;

  @Field(() => String, { nullable: false })
  name: string;

  @Field(() => String, { nullable: true })
  customUrl?: string;

  @Field(() => String, { nullable: true })
  thumbnailImageUrl?: string;

  @Field(() => Boolean, { nullable: false, defaultValue: false })
  isVerified: boolean;

  @Field(() => Boolean, { nullable: false, defaultValue: false })
  isVisible: boolean;

  @Field(() => CollectionsType, { nullable: false, defaultValue: 'UNKNOWN' })
  type: keyof typeof CollectionsType;

  @Field(() => String, { nullable: true })
  importedAt?: string;

  @Field(() => Int, { nullable: true })
  createdAt?: number;

  @Field(() => Int, { nullable: true })
  updatedAt?: number;

  @Field(() => MarketplaceUser, { nullable: true })
  creator?: MarketplaceUser;
}
