import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { IsEthereumAddress } from 'class-validator';
import { CollectionDTO } from '../collections/collection.response';

@ArgsType()
@ObjectType()
export class MinimumOfferDTO {
  @IsEthereumAddress()
  @Field()
  userAddress: string;

  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @Field()
  editionCount?: number;

  @Field({ nullable: true })
  price?: string | null;

  @Field(() => CollectionDTO, { nullable: true })
  collection?: CollectionDTO | null;
}
