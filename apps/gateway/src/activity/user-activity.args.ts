import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress } from 'class-validator';
import { BaseActivityArgs } from './base-activity.args';

@ArgsType()
export class GetUserActivityArgs extends BaseActivityArgs {
  @Field()
  @IsEthereumAddress()
  userAddress: string;
}
