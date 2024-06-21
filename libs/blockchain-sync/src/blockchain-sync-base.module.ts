import { GrpcClientModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisBullModule, RedisClientModule } from '@app/redis-client';
import { Web3Module } from '@app/web3';
import { ContractModule } from '@blockchain/contract';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/blockchain';
import { MetricsController } from 'common/metrics.controller';
import { BlockchainSyncService } from './blockchain-sync.service';

@Module({})
export class BlockchainSyncBaseModule {
  static register(queueName: string): DynamicModule {
    return {
      module: BlockchainSyncBaseModule,
      imports: [
        RedisClientModule,
        GrpcClientModule.register(GrpcClientKind.NFT, GrpcClientKind.SALE),
        RedisBullModule.register({ defaultJobOptions: { removeOnFail: true } }),
        BullModule.registerQueue({ name: queueName }),
        ContractModule,
        Web3Module,
      ],
      controllers: [MetricsController],
      providers: [PrismaClient, BlockchainSyncService],
      exports: [
        BullModule,
        PrismaClient,
        ContractModule,
        Web3Module,
        RedisClientModule,
        BlockchainSyncService,
      ],
    };
  }
}
