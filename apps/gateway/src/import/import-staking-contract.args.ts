import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsUUID } from 'class-validator';

@ArgsType()
export class ImportStakingContractArgs {
  @IsUUID()
  @Field()
  collectionId: string;

  @IsEthereumAddress()
  @Field()
  stakingContractAddress: string;
}
