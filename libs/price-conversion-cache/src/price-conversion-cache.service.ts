import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  PriceConversionServiceClient,
  PRICE_CONVERSION_SERVICE_NAME,
} from '@generated/ts-proto/services/price_conversion';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Cache } from 'cache-manager';
import { lastValueFrom, map } from 'rxjs';

@Injectable()
export class PriceConversionCacheService {
  private static readonly CONVERSION_RATES_CACHE_KEY = 'CONVERSION_RATES';
  private static readonly CONVERSION_RATES_CACHE_TTL = 1000 * 60 * 60; // 1 hour

  private grpcPriceConversion: PriceConversionServiceClient;

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    @Inject(GrpcClientKind.PRICE_CONVERSION)
    private readonly priceConversionClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcPriceConversion = this.priceConversionClient.getService(
      PRICE_CONVERSION_SERVICE_NAME,
    );
  }

  /**
   * @returns Map [smart conctract address] -> [usd price]
   */
  async getLatestRatesByCurrency() {
    const cacheKey = PriceConversionCacheService.CONVERSION_RATES_CACHE_KEY;
    const cacheTTL = PriceConversionCacheService.CONVERSION_RATES_CACHE_TTL;

    let rates: Record<string, number> = await this.cacheManager.get(cacheKey);

    if (!rates) {
      rates = await lastValueFrom(
        this.grpcPriceConversion
          .getLatestRatesByCurrency(null)
          .pipe(map(({ rates }) => rates)),
      );

      this.cacheManager.set(cacheKey, rates, cacheTTL);
    }

    return rates;
  }
}
