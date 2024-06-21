import { ArgsType, Field, InputType, Int } from '@nestjs/graphql';
import { IsArray } from 'class-validator';

@InputType()
@ArgsType()
export class GetSalesVolumeRangeArgs {
  @Field()
  type: 'block' | 'time';

  @Field(() => Int)
  from: number;

  @Field(() => Int)
  to: number;
}

@InputType()
@ArgsType()
export class GetSalesVolumeArgs {
  @IsArray()
  @Field(() => [String])
  smartContractAddresses: string[];

  @Field(() => GetSalesVolumeRangeArgs)
  range: GetSalesVolumeRangeArgs;
}
