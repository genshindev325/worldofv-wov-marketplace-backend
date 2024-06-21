import { ArgsType, Field, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsRFC3339,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { UsersVerifiedStatus } from '../user/users-verified-status.enum';

@ArgsType()
export class UpsertHomeCollectionArgs {
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  id?: string | null;

  @IsPositive()
  @IsInt()
  @Field(() => Int)
  position: number;

  @Field()
  title: string;

  @IsRFC3339()
  @Field()
  startsAt: string;

  @IsUrl()
  @Field()
  bannerImageUrl: string;

  @IsUrl()
  @Field()
  bannerLinkUrl: string;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  avatarImageUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  avatarLinkUrl?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  avatarName?: string | null;

  @IsOptional()
  @Field(() => UsersVerifiedStatus, { nullable: true })
  avatarVerifiedLevel?: UsersVerifiedStatus | null;
}

@ArgsType()
export class DeleteHomeCollectionArgs {
  @IsUUID()
  @Field()
  id: string;
}
