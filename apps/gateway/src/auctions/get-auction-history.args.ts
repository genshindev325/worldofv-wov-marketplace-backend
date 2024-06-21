import { ArgsType, Field } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@ArgsType()
export class GetAuctionHistoryArgs {
  @IsString()
  @Field()
  auctionId: string;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  bidsOnly?: boolean | null;
}
