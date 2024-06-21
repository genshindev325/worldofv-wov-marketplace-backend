import { Field, ObjectType } from '@nestjs/graphql';
import { MarketplaceCollection } from '../common/marketplace-collection.response';
import { MetaPagination } from '../common/meta-pagination.response';

@ObjectType()
export class GetCollectionsResponse {
  @Field(() => [MarketplaceCollection])
  items: MarketplaceCollection[];

  @Field(() => MetaPagination)
  meta: MetaPagination;
}
