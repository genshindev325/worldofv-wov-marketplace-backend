import { ProfileTabs } from '@generated/ts-proto/types/user';
import { ArgsType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsUrl, ValidateIf } from 'class-validator';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@ArgsType()
export class UpdateUserArgs {
  @IsOptional()
  @IsEmail()
  @Field({ nullable: true })
  email?: string;

  @IsOptional()
  @Field({ nullable: true })
  description?: string;

  @IsOptional()
  @Field({ nullable: true })
  customUrl?: string;

  @ValidateIf((v) => !!v.websiteUrl)
  @IsUrl()
  @Field({ nullable: true })
  websiteUrl?: string;

  @ValidateIf((v) => !!v.facebookUrl)
  @IsUrl()
  @Field({ nullable: true })
  facebookUrl?: string;

  // TODO!: Remove this after social account verification is finalized!!!
  @ValidateIf((v) => !!v.twitterUrl)
  @IsUrl()
  @Field({ nullable: true })
  twitterUrl?: string;

  @ValidateIf((v) => !!v.discordUrl)
  @IsUrl()
  @Field({ nullable: true })
  discordUrl?: string;

  @ValidateIf((v) => !!v.instagramUrl)
  @IsUrl()
  @Field({ nullable: true })
  instagramUrl?: string;

  @IsOptional()
  @Field(() => ProfileTabs, { nullable: true })
  landingTab?: ProfileTabs;

  @IsOptional()
  @Field({ nullable: true })
  showEmail?: boolean;

  @IsOptional()
  @Field({ nullable: true })
  showBalance?: boolean;

  @IsOptional()
  @Field({ nullable: true })
  isEmailNotificationEnabled?: boolean;

  @IsOptional()
  @Field(() => GraphQLUpload, { nullable: true })
  profileImage?: Promise<FileUpload> | null;

  @IsOptional()
  @Field(() => GraphQLUpload, { nullable: true })
  bannerImage?: Promise<FileUpload> | null;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;
}
