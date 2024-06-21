import { GrpcOptionsModule } from '@app/grpc-options';
import { RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/sale';
import { MetricsController } from 'common/metrics.controller';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('sale'),
    GrpcOptionsModule,
    RedisClientModule,
  ],
  controllers: [SaleController, MetricsController],
  providers: [PrismaClient, SaleService],
})
export class SaleModule {}
