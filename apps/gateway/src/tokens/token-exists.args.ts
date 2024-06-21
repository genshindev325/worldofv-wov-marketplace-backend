import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';

@ArgsType()
@InputType()
export class TokenExistsArgs {
  @IsEthereumAddress()
  @Field(() => String)
  smartContractAddress: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  tokenId?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string | null;
}
