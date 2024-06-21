import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisBullModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EditionService } from './edition.service';
import { NftConsumer } from './nft.consumer';
import { NftProducer } from './nft.producer';
import { PhygitalConsumer } from './phygital.consumer';
import { TokenService } from './token.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-nft'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.NFT),
    BlockchainSyncBaseModule.register('blockchain/nft'),
    RedisBullModule.register(),
    BullModule.registerQueue({ name: 'blockchain/phygital' }),
    HttpModule,
  ],
  providers: [
    TokenService,
    EditionService,
    NftProducer,
    NftConsumer,
    PhygitalConsumer,
  ],
})
export class BlockchainSyncNftModule {}
