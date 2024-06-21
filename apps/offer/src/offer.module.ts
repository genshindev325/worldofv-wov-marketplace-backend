import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheModule } from '@app/price-conversion-cache';
import { RedisCacheModule, RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/offer';
import { MetricsController } from 'common/metrics.controller';
import { MinimumOfferController } from './minimum-offer.controller';
import { OfferAggregationController } from './offer-aggregation.controller';
import { OfferAggregationService } from './offer-aggregation.service';
import { OfferEmailService } from './offer-email.service';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisClientModule,
    RedisCacheModule,
    PriceConversionCacheModule,
    TracingModule.register('offer'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.NFT,
      GrpcClientKind.IMAGE_THUMBNAIL,
      GrpcClientKind.USER,
      GrpcClientKind.SALE,
      GrpcClientKind.AUCTION,
      GrpcClientKind.MARKETPLACE,
      GrpcClientKind.EMAIL,
    ),
  ],
  controllers: [
    OfferController,
    MinimumOfferController,
    OfferAggregationController,
    MetricsController,
  ],
  providers: [
    PrismaClient,
    OfferService,
    OfferAggregationService,
    OfferEmailService,
  ],
})
export class OfferModule {}
