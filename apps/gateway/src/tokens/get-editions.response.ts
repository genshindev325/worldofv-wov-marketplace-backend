import { Field, ObjectType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MarketplaceEdition } from './get-tokens.response';

@ObjectType()
export class GetEditionsResponse {
  @IsOptional()
  @Field(() => [MarketplaceEdition], { nullable: true })
  items?: MarketplaceEdition[] | null;
}
