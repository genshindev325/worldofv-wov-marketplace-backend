import { BlockchainSyncService } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { S3Module } from '@app/s3';
import { ContractModule } from '@blockchain/contract';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NftModule } from '../nft.module';
import { TokenService } from '../token/token.service';
import { CollectionConsumer } from './collection.consumer';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

@Module({
  imports: [
    forwardRef(() => NftModule),
    ConfigModule.forRoot(),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.NFT,
      GrpcClientKind.SALE,
      GrpcClientKind.OFFER,
      GrpcClientKind.USER,
    ),
    S3Module,
    BullModule.registerQueue({ name: 'nft/collection/resync' }),
    HttpModule,
    ContractModule,
  ],
  controllers: [CollectionController],
  providers: [
    CollectionService,
    CollectionConsumer,
    BlockchainSyncService,
    TokenService,
  ],
  exports: [CollectionService],
})
export class CollectionModule {}
