import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  PriceConversionServiceClient,
  PRICE_CONVERSION_SERVICE_NAME,
} from '@generated/ts-proto/services/price_conversion';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, map } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { ConversionRate } from './conversion-rate.response';

@Resolver()
export class PriceConversionResolver implements OnModuleInit {
  private readonly logger = new Logger(PriceConversionResolver.name);

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_SLOW_CACHE_TTL) || 0;

  private grpcConversion: PriceConversionServiceClient;

  constructor(
    @Inject(GrpcClientKind.PRICE_CONVERSION)
    private readonly conversionClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcConversion = this.conversionClient.getService(
      PRICE_CONVERSION_SERVICE_NAME,
    );
  }

  @Query(() => [ConversionRate])
  @CacheControl(PriceConversionResolver.CACHE_TTL)
  async getLatestConversionRates() {
    return await lastValueFrom(
      this.grpcConversion
        .getLatestRates(null)
        .pipe(map(({ rates }) => rates || [])),
    );
  }
}
