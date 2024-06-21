import { ArgsType, Field, InputType } from '@nestjs/graphql';
import {
  IsEthereumAddress,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

@ArgsType()
@InputType()
export class FindOneCollectionArgs {
  @IsOptional()
  @IsUUID()
  @Field(() => String, { nullable: true })
  collectionId?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  blockchainId?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field(() => String, { nullable: true })
  smartContractAddress?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  customUrl?: string | null;
}
