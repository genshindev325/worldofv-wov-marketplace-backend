import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';
import { PaginationArgs } from 'common/pagination.args';

@InputType()
class GetCollectionsFilterArgs {
  @IsEthereumAddress()
  @Field()
  creatorAddress: string;
}

@ArgsType()
export class GetCollectionsArgs {
  @IsOptional()
  @Field(() => PaginationArgs, { nullable: true })
  pagination?: PaginationArgs | null;

  @Field(() => GetCollectionsFilterArgs)
  filters: GetCollectionsFilterArgs | null;
}
