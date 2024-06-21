import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsString } from 'class-validator';

@ArgsType()
export class FindOneTokenArgs {
  @IsString()
  @Field(() => String)
  tokenId: string;

  @IsEthereumAddress()
  @Field(() => String)
  smartContractAddress: string;
}
