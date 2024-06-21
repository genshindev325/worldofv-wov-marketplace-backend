import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class CheckTransactionArgs {
  @Field()
  txID: string;

  @Field(() => [String], { nullable: true })
  eventNames?: string[];
}
