import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsPositive, IsUrl } from 'class-validator';

@ArgsType()
export class UpsertBrandArgs {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @IsUrl()
  @Field()
  thumbnailImageUrl: string;

  @IsOptional()
  @IsPositive()
  @IsInt()
  @Field(() => Int)
  position?: number;
}
