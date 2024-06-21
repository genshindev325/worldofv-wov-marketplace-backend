import { Field, Int, ObjectType } from '@nestjs/graphql';
import { UsersVerifiedStatus } from '../user/users-verified-status.enum';

@ObjectType()
export class HomeCollection {
  @Field()
  id: string;

  @Field(() => Int)
  position: number;

  @Field()
  title: string;

  @Field()
  startsAt: string;

  @Field()
  bannerImageUrl: string;

  @Field()
  bannerLinkUrl: string;

  @Field({ nullable: true })
  avatarImageUrl?: string | null;

  @Field({ nullable: true })
  avatarLinkUrl?: string | null;

  @Field({ nullable: true })
  avatarName?: string | null;

  @Field(() => UsersVerifiedStatus, { nullable: true })
  avatarVerifiedLevel?: UsersVerifiedStatus | null;
}
