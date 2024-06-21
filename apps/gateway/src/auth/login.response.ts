import { Field, ObjectType } from '@nestjs/graphql';

import { User } from 'apps/gateway/src/user/user.response';

@ObjectType()
export class LoginResponse {
  @Field()
  jwt: string;

  @Field(() => User)
  user: User;
}
