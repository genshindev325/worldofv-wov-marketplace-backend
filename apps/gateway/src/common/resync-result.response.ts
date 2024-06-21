import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ReSyncResult {
  @Field(() => Boolean)
  done: boolean;
}
