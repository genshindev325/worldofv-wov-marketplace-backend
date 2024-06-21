import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';

@ArgsType()
export class GetOwnedCountByCollectionArgs {
  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  ownerAddress?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  smartContractAddress?: string | null;
}
