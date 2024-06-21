import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GenesisCount {
  @Field()
  set: string;

  @Field(() => Int)
  count: number;
}
