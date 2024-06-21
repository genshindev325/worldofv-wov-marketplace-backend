import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';

@ArgsType()
export class GetGenesisCountBySetArgs {
  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  ownerAddress?: string | null;
}
