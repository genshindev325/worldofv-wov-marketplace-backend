import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class SearchByStringArgs {
  @Field()
  text: string;

  @Field({ nullable: true })
  limit?: number;

  @Field({ nullable: true })
  onlyStakable?: boolean;
}
