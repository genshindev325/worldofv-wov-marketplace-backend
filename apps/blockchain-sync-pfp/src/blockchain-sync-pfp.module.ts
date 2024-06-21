import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { FileUploadModule } from '@app/file-upload';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { PfpConsumer } from './pfp.consumer';
import { PfpProducer } from './pfp.producer';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-pfp'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.NFT,
      GrpcClientKind.NFT_IMPORT,
      GrpcClientKind.BLOCKCHAIN_SYNC_STAKE,
    ),
    HttpModule,
    FileUploadModule,
    BlockchainSyncBaseModule.register('blockchain/pfp'),
  ],
  providers: [PfpConsumer],
  exports: [ClientsModule, PfpConsumer],
  controllers: [PfpProducer],
})
export class BlockchainSyncPfpModule {}
