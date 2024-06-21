import { Field, ObjectType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';

@ObjectType()
export class SearchCollectionResponse {
  @Field({ nullable: true })
  collectionId?: string;

  @Field({ nullable: true })
  @IsEthereumAddress()
  @IsOptional()
  smartContractAddress?: string;

  @IsOptional()
  @Field(() => [String], { nullable: true })
  stakingContractAddresses?: string[] | null;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  customUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  thumbnailImageUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  isVerified?: boolean;
}
