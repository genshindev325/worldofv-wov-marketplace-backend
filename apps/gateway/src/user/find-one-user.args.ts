import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsEmail, IsEthereumAddress, IsOptional } from 'class-validator';

@ArgsType()
export class FindOneUserArgs {
  @IsEthereumAddress()
  @IsOptional()
  @Field({ nullable: true })
  address?: string;

  @IsOptional()
  @Field(() => Int, { nullable: true })
  profileId?: number;

  @IsOptional()
  @Field({ nullable: true })
  customUrl?: string;

  @IsOptional()
  @IsEmail()
  @Field({ nullable: true })
  email?: string;
}
