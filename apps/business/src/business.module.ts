import { GrpcOptionsModule } from '@app/grpc-options';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/business';
import { MetricsController } from 'common/metrics.controller';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

@Module({
  imports: [GrpcOptionsModule, TracingModule.register('business')],
  controllers: [BusinessController, MetricsController],
  providers: [BusinessService, PrismaClient],
})
export class BusinessModule {}
