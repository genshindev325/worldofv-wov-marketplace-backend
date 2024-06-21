import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GetCurrentMonthFeesResponse {
  @Field({ nullable: true })
  fees?: string | null;
}
