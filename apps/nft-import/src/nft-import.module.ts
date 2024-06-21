import { BlockchainSyncService } from '@app/blockchain-sync';
import { FileUploadModule } from '@app/file-upload';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisBullModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { ContractModule } from '@blockchain/contract';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { MetricsController } from 'common/metrics.controller';
import { NftImportController } from './nft-import.controller';
import { NftImportService } from './nft-import.service';
import { SmartContractModule } from './smart-contract/smart-contract.module';
import { TokenFetcherService } from './smart-contract/token-fetcher.service';
import { StakingContractModule } from './staking-contract/staking-contract.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('nft-import'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.NFT,
      GrpcClientKind.BLOCKCHAIN_SYNC_PFP,
      GrpcClientKind.BLOCKCHAIN_SYNC_STAKE,
      GrpcClientKind.SALE,
    ),
    RedisBullModule.register(),
    HttpModule,
    FileUploadModule,
    SmartContractModule,
    StakingContractModule,
    ContractModule,
  ],
  controllers: [NftImportController, MetricsController],
  providers: [BlockchainSyncService, NftImportService, TokenFetcherService],
  exports: [
    BlockchainSyncService,
    ClientsModule,
    BullModule,
    HttpModule,
    NftImportService,
    ContractModule,
  ],
})
export class NftImportModule {}
