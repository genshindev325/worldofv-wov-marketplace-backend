import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheModule } from '@app/price-conversion-cache';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client/aplos-stats';
import { MetricsController } from 'common/metrics.controller';
import { AplosStatsController } from './aplos-stats.controller';
import { AplosStatsService } from './aplos-stats.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GrpcOptionsModule,
    ScheduleModule.forRoot(),
    CacheModule.register(),
    HttpModule,
    TracingModule.register('aplos-stats'),
    PriceConversionCacheModule,
    GrpcClientModule.register(
      GrpcClientKind.APLOS_STATS,
      GrpcClientKind.NFT,
      GrpcClientKind.USER,
    ),
    ConfigModule.forRoot(),
  ],
  controllers: [AplosStatsController, MetricsController],
  providers: [AplosStatsService, PrismaClient],
})
export class AplosStatsModule {}
