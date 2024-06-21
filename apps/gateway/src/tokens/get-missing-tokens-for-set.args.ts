import { ArgsType, Field } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional, Matches } from 'class-validator';
import { PaginationArgs } from 'common/pagination.args';

@ArgsType()
export class GetMissingTokensArgs {
  @IsEthereumAddress()
  @IsOptional()
  @Field({ nullable: true })
  ownerAddress?: string | null;

  @Matches(/^[a-zA-Z\s]*$/)
  @IsOptional()
  @Field({ nullable: true })
  set?: string | null;

  @IsOptional()
  @Field(() => PaginationArgs, { nullable: true })
  pagination?: PaginationArgs | null;
}
