import { GrpcOptionsModule } from '@app/grpc-options';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client/price-conversion';
import { MetricsController } from 'common/metrics.controller';
import { PriceConversionController } from './price-conversion.controller';
import { PriceConversionService } from './price-conversion.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    HttpModule,
    TracingModule.register('price-conversion'),
    GrpcOptionsModule,
  ],
  controllers: [PriceConversionController, MetricsController],
  providers: [PriceConversionService, PrismaClient],
})
export class PriceConversionModule {}
