import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress } from 'class-validator';
import { BaseActivityArgs } from './base-activity.args';

@ArgsType()
export class GetCollectionActivityArgs extends BaseActivityArgs {
  @Field()
  @IsEthereumAddress()
  smartContractAddress: string;
}
