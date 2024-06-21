import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional, IsUUID } from 'class-validator';

@ArgsType()
export class GetStakedTokensArgs {
  @IsEthereumAddress()
  @Field()
  ownerAddress: string;

  @IsUUID()
  @Field()
  collectionId: string;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  stakingContractAddress?: string | null;
}
