import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuctionConsumer } from './auction.consumer';
import { BlockchainSyncAuctionController } from './auction.controller';
import { AuctionProducer } from './auction.producer';
import { AuctionService } from './auction.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    BlockchainSyncBaseModule.register('blockchain/auction'),
    TracingModule.register('blockchain-sync-auction'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.USER, GrpcClientKind.AUCTION),
  ],
  controllers: [BlockchainSyncAuctionController],
  providers: [AuctionService, AuctionProducer, AuctionConsumer],
})
export class BlockchainSyncAuctionModule {}
