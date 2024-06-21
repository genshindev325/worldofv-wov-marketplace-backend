import { Field, ObjectType } from '@nestjs/graphql';
import { User } from 'apps/gateway/src/user/user.response';

@ObjectType()
export class ActivityUser {
  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field()
  count: number;
}

@ObjectType()
export class GetRecepientCountForCollectionResponse {
  @Field()
  hasMore: boolean;

  @Field(() => [ActivityUser], { nullable: true })
  users?: ActivityUser[] | null;
}
