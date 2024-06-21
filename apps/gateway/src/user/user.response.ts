import { ProfileTabs, VerifiedStatus } from '@generated/ts-proto/types/user';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AssetDTO } from '../common/asset.response';

registerEnumType(VerifiedStatus, { name: 'VerifiedStatus' });
registerEnumType(ProfileTabs, { name: 'ProfileTabs' });

@ObjectType()
export class User {
  @Field()
  address: string;

  @Field(() => Int, { nullable: true })
  profileId?: number;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  customUrl?: string;

  @Field({ nullable: true })
  websiteUrl?: string;

  @Field({ nullable: true })
  facebookUrl?: string;

  @Field({ nullable: true })
  twitterUrl?: string;

  @Field({ nullable: true })
  discordUrl?: string;

  @Field({ nullable: true })
  instagramUrl?: string;

  @Field({ nullable: true })
  blacklisted?: boolean;

  @Field({ nullable: true })
  verified?: boolean;

  @Field(() => VerifiedStatus, { nullable: true })
  verifiedLevel?: VerifiedStatus;

  @Field({ nullable: true })
  profileImageUrl?: string;

  @Field({ nullable: true })
  bannerImageUrl?: string;

  @Field(() => ProfileTabs, { nullable: true })
  landingTab?: ProfileTabs;

  @Field({ nullable: true })
  isAdmin?: boolean;

  @Field({ nullable: true })
  showEmail?: boolean;

  @Field({ nullable: true })
  showBalance?: boolean;

  @Field({ nullable: true })
  isEmailNotificationEnabled?: boolean;

  @Field(() => [AssetDTO], { nullable: true })
  assets?: AssetDTO[];
}
