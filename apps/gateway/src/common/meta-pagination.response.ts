import { Field, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

@ObjectType()
export class MetaPagination {
  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  hasMore?: boolean | true;

  @IsOptional()
  @IsNumber()
  @Field({ nullable: true })
  total?: number | null;
}
