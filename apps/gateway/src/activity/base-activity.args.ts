import { ArgsType, Field } from '@nestjs/graphql';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

@ArgsType()
export class BaseActivityArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  fromDate?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(16)
  perPage?: number | null;
}
