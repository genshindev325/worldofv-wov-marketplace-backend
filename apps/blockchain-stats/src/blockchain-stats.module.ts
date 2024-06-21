import { GrpcOptionsModule } from '@app/grpc-options';
import { TracingModule } from '@app/tracing';
import { ContractModule } from '@blockchain/contract';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from 'common/metrics.controller';
import { BlockchainStatsController } from './blockchain-stats.controller';
import { BlockchainStatsService } from './blockchain-stats.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ContractModule,
    GrpcOptionsModule,
    TracingModule.register('blockchain-stats'),
  ],
  controllers: [BlockchainStatsController, MetricsController],
  providers: [BlockchainStatsService],
})
export class BlockchainStatsModule {}
