import {
  GetOffersForTokenArgs,
  GetOffersForUserArgs,
  OfferAggregationServiceController,
  OfferAggregationServiceControllerMethods,
} from '@generated/ts-proto/services/offer';
import { Controller, Logger } from '@nestjs/common';
import { OfferAggregationService } from './offer-aggregation.service';

@Controller()
@OfferAggregationServiceControllerMethods()
export class OfferAggregationController
  implements OfferAggregationServiceController
{
  private readonly logger = new Logger(OfferAggregationController.name);

  constructor(
    private readonly offerAggregationService: OfferAggregationService,
  ) {}

  async getOffersForUser(args: GetOffersForUserArgs) {
    return await this.offerAggregationService.getOffersForUser(args);
  }

  async getOffersForToken(args: GetOffersForTokenArgs) {
    const offers = await this.offerAggregationService.getOffersForToken(args);
    return { offers };
  }
}
