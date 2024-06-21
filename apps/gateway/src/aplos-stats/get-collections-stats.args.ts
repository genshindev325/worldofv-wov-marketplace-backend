import {
  ArgsType,
  Field,
  InputType,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import { Interval } from '@prisma/client/aplos-stats';
import { IsInt, IsString, Min } from 'class-validator';

registerEnumType(Interval, { name: 'Interval' });

@InputType()
class AplosPaginationArgs {
  @IsString()
  @Field(() => String, { nullable: true })
  lastItemPrimary?: string | null;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  perPage: number;
}

@ArgsType()
export class GetCollectionsStatsArgs {
  @Field(() => AplosPaginationArgs, { nullable: true })
  pagination?: AplosPaginationArgs | null;

  @IsString()
  @Field(() => Interval)
  timeframe: Interval;
}
