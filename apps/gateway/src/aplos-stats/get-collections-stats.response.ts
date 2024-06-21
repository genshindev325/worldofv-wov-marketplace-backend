import { Field, ObjectType } from '@nestjs/graphql';

import { CollectionDTO } from '../collections/collection.response';

@ObjectType()
class FloorPrice {
  @Field({ nullable: true })
  price?: string | null;

  @Field()
  currency: string;
}

@ObjectType()
export class CollectionStats {
  @Field()
  smartContactAddress: string;

  @Field()
  name: string;

  @Field(() => CollectionDTO, { nullable: true })
  collection?: CollectionDTO | null;

  @Field(() => FloorPrice)
  floorPrice: FloorPrice;

  @Field()
  averagePriceVET: string;

  @Field()
  averagePriceWOV: string;

  @Field()
  itemsSold: number;

  @Field()
  volumeVET: string;

  @Field()
  volumeWOV: string;

  @Field()
  volumeSumInVet: string;

  @Field({ nullable: true })
  percentageChange?: string | null;

  @Field()
  ownerCount: number;

  @Field()
  totalItemsSold: number;

  @Field()
  totalVolumeVET: string;

  @Field()
  totalVolumeWOV: string;

  @Field()
  totalVolumeSumInVet: string;
}

@ObjectType()
export class GetCollectionsStatsResponse {
  @Field(() => [CollectionStats], { nullable: true })
  collectionStats?: CollectionStats[] | null;
}
