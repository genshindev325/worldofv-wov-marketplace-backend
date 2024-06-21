import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client/price-conversion';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PriceConversionService {
  private readonly logger = new Logger(PriceConversionService.name);

  private readonly VEXCHANGE_API_URL = process.env.VEXCHANGE_API_URL;
  private readonly COINGECKO_API_URL = process.env.COINGECKO_API_URL;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly httpService: HttpService,
  ) {}

  public async getLatestRates() {
    const rates = await Promise.all([
      this.prisma.conversionRate.findFirst({
        where: { currency: 'VET' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.conversionRate.findFirst({
        where: { currency: 'WoV' },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    // vVET can always be exchanged 1 to 1 for VET so we add an entry for
    // convenience.
    rates.push({
      ...rates.find((r) => r.currency === 'VET'),
      currency: 'vVET',
    });

    return rates.map((rate) => ({
      ...rate,
      updatedAt: rate.updatedAt.toISOString(),
    }));
  }

  @Timeout(10000)
  async getInitialPrices() {
    const count = await this.prisma.conversionRate.count();

    if (!count) {
      this.savePrice('WoV', this.getPriceWoV.bind(this));
      this.savePrice('VET', this.getPriceVET.bind(this));
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async getPriceEveryHour() {
    this.savePrice('WoV', this.getPriceWoV.bind(this));
    this.savePrice('VET', this.getPriceVET.bind(this));
  }

  private async savePrice(currency: string, fetcher: () => Promise<number>) {
    const priceUSD = await fetcher();

    return await this.prisma.conversionRate.create({
      data: { currency, priceUSD, updatedAt: new Date() },
    });
  }

  private async getPriceWoV(): Promise<number> {
    this.logger.log('Get WoV/USD price form Vexchange');

    const observable$ = this.httpService.get(
      `${this.VEXCHANGE_API_URL}/tokens/0x170F4BA8e7ACF6510f55dB26047C83D13498AF8A`,
    );

    const response = await lastValueFrom(observable$);
    const price = response.data.usdPrice;

    this.logger.log(`WoV/USD price is "${price}"`);

    return price;
  }

  private async getPriceVET(): Promise<number> {
    this.logger.log('Get VET/USD price form CoinGecko');

    const observable$ = this.httpService.get(
      `${this.COINGECKO_API_URL}/simple/price?ids=vechain&vs_currencies=usd`,
    );

    const response = await lastValueFrom(observable$);
    const price = response.data.vechain.usd;

    this.logger.log(`VET/USD price is "${price}"`);

    return price;
  }
}
