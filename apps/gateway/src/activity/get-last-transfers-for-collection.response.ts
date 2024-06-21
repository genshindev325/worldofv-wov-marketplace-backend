import { Field, ObjectType } from '@nestjs/graphql';
import { User } from 'apps/gateway/src/user/user.response';

@ObjectType()
export class LastTransfersUser {
  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field({ nullable: true })
  dateTime?: string | null;
}

@ObjectType()
export class GetLastTransfersForCollectionResponse {
  @Field()
  hasMore: boolean;

  @Field(() => [LastTransfersUser], { nullable: true })
  users?: LastTransfersUser[] | null;
}
