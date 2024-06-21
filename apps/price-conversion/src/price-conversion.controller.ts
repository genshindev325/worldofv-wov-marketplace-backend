import {
  PriceConversionServiceController,
  PriceConversionServiceControllerMethods,
} from '@generated/ts-proto/services/price_conversion';
import { Controller } from '@nestjs/common';
import { PriceConversionService } from './price-conversion.service';

@Controller()
@PriceConversionServiceControllerMethods()
export class PriceConversionController
  implements PriceConversionServiceController
{
  constructor(
    private readonly priceConversionService: PriceConversionService,
  ) {}

  async getLatestRatesByCurrency() {
    const rates = await this.priceConversionService.getLatestRates();

    const ratesByCurrency = rates.reduce(
      (rs, r) => ({ ...rs, [r.currency]: r.priceUSD }),
      {},
    );

    return { rates: ratesByCurrency };
  }

  async getLatestRates() {
    const rates = await this.priceConversionService.getLatestRates();
    return { rates };
  }
}
