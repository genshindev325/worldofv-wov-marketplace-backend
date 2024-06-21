import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';

@ArgsType()
@InputType()
export class CollectionResyncArgs {
  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @IsOptional()
  @Field(() => [String], { defaultValue: [] })
  tokenIds: string[];
}
