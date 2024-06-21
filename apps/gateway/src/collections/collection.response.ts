import { Field, ObjectType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client/nft';
import { User } from 'apps/gateway/src/user/user.response';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';
import { CollectionType } from './collection-type.enum';

@ObjectType()
export class CollectionDTO {
  @Field()
  collectionId?: string;

  @Field({ nullable: true })
  blockchainId?: string | null;

  @Field({ nullable: true })
  smartContractAddress?: string | null;

  @Field({ nullable: true })
  burnContractAddress?: string | null;

  @Field({ nullable: true })
  cooldownContractAddress?: string | null;

  @Field(() => [String], { nullable: true })
  stakingContractAddresses?: string[] | null;

  @Field({ nullable: true })
  stakingEndDate?: string | null;

  @Field()
  isStakingActive?: boolean | null;

  @Field({ nullable: true })
  creatorAddress?: string | null;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field({ nullable: true })
  customUrl?: string | null;

  @Field({ nullable: true })
  mintPageUrl?: string | null;

  @Field({ nullable: true })
  thumbnailImageUrl?: string | null;

  @Field({ nullable: true })
  bannerImageUrl?: string | null;

  @Field(() => GraphQLDecimal, { nullable: true })
  minimumOffer?: Prisma.Decimal | number | string | null;

  @Field({ nullable: true })
  isVerified?: boolean | null;

  @Field({ nullable: true })
  isVisible?: boolean | null;

  @Field({ nullable: true })
  isMinting?: boolean | null;

  @Field(() => CollectionType)
  type: keyof typeof CollectionType;

  @Field({ nullable: true })
  importedAt?: string | null;

  @Field({ nullable: true })
  createdAt?: number | null;

  @Field({ nullable: true })
  updatedAt?: number | null;

  @Field({ nullable: true })
  brandId?: string | null;

  @Field(() => User, { nullable: true })
  creator?: User | null;
}
