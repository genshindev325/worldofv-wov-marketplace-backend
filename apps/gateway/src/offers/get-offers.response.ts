import { Field, ObjectType } from '@nestjs/graphql';
import { MetaPagination } from '../common/meta-pagination.response';
import { OfferDTO } from './offer.response';

@ObjectType()
export class GetOffersForUserResponse {
  @Field(() => [OfferDTO], { nullable: true })
  offers?: OfferDTO[] | null;

  @Field(() => MetaPagination)
  meta: MetaPagination;
}
