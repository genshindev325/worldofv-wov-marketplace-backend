import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StakeConsumer } from './blockchain-sync-stake.consumer';
import { StakeProducer } from './blockchain-sync-stake.producer';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-stake'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.NFT),
    BlockchainSyncBaseModule.register('blockchain/stake'),
  ],
  controllers: [StakeProducer],
  providers: [StakeConsumer],
})
export class BlockchainSyncStakeModule {}
