import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress } from 'class-validator';

@ArgsType()
export class GetMinimumOffersForUserArgs {
  @IsEthereumAddress()
  @Field()
  userAddress: string;
}

@ArgsType()
export class UpsertMinimumOfferArgs {
  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @Field({ nullable: true })
  price?: string | null;
}
