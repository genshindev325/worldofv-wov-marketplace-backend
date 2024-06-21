import { Field, ObjectType } from '@nestjs/graphql';

import { User } from '../user/user.response';

@ObjectType()
export class BuyersStats {
  @Field()
  buyerAddress: string;

  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field()
  itemsBought: number;

  @Field()
  volumeVET: string;

  @Field()
  volumeWOV: string;

  @Field()
  volumeSumInVet: string;

  @Field({ nullable: true })
  percentageChange?: string | null;

  @Field()
  totalItemsBought: number;

  @Field()
  totalVolumeVET: string;

  @Field()
  totalVolumeWOV: string;

  @Field()
  totalVolumeSumInVet: string;
}

@ObjectType()
export class GetBuyersStatsResponse {
  @Field(() => [BuyersStats], { nullable: true })
  buyersStats?: BuyersStats[] | null;
}
