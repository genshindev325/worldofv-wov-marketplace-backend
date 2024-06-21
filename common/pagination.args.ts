import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Min } from 'class-validator';

@InputType()
export class PaginationArgs {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Field(() => Int)
  page: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Field(() => Int)
  perPage: number;
}
