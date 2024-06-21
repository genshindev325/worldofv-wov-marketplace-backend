import { ArgsType, Field, Int } from '@nestjs/graphql';
import {
  IsEthereumAddress,
  IsInt,
  IsOptional,
  IsPositive,
  IsRFC3339,
  IsUrl,
  IsUUID,
} from 'class-validator';

@ArgsType()
export class UpsertVerifiedDropArgs {
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  id: string;

  @IsPositive()
  @IsInt()
  @Field(() => Int)
  position: number;

  @IsRFC3339()
  @Field()
  dateTime: string;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  imageUrl?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  title?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  address?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  collectionId?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  tokenId?: string | null;
}

@ArgsType()
export class DeleteVerifiedDropArgs {
  @IsUUID()
  @Field()
  id: string;
}
