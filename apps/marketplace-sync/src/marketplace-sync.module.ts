import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheModule } from '@app/price-conversion-cache';
import { RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from 'common/metrics.controller';
import { MarketplaceSyncController } from './marketplace-sync.controller';
import { MarketplaceSyncService } from './marketplace-sync.service';
import PrismaClientMarketplaceSync from './prisma-client-marketplace-sync';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisClientModule,
    PriceConversionCacheModule,
    TracingModule.register('marketplace-sync'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.USER,
      GrpcClientKind.NFT,
      GrpcClientKind.SALE,
      GrpcClientKind.AUCTION,
      GrpcClientKind.IMAGE_THUMBNAIL,
      GrpcClientKind.OFFER,
    ),
  ],
  controllers: [MarketplaceSyncController, MetricsController],
  providers: [PrismaClientMarketplaceSync, MarketplaceSyncService],
})
export class MarketplaceSyncModule {}
