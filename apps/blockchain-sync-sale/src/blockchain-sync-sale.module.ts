import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SaleConsumer } from './sale.consumer';
import { SaleProducer } from './sale.producer';
import { SaleService } from './sale.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-sale'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.SALE),
    BlockchainSyncBaseModule.register('blockchain/sale'),
  ],
  providers: [SaleService, SaleProducer, SaleConsumer],
})
export class BlockchainSyncSaleModule {}
