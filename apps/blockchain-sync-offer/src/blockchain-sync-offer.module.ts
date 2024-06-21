import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OfferConsumer } from './offer.consumer';
import { OfferProducer } from './offer.producer';
import { OfferService } from './offer.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-offer'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.OFFER),
    BlockchainSyncBaseModule.register('blockchain/offer'),
  ],
  providers: [OfferService, OfferProducer, OfferConsumer],
})
export class BlockchainSyncOfferModule {}
