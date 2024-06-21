import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress, IsString } from 'class-validator';

@ArgsType()
@InputType()
export class UpdateFreeShippingArgs {
  @IsEthereumAddress()
  @Field(() => String)
  smartContractAddress: string;

  @IsString()
  @Field(() => String)
  editionId: string;

  @Field(() => Boolean)
  isFreeShipping: boolean;
}
