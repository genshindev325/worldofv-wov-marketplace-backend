import { ArgsType, Field } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';

@ArgsType()
export class GetAuctionArgs {
  @Field()
  auctionId: string;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  includeToken?: boolean | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  includeSeller?: boolean | null;
}
