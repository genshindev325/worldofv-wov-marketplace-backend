import { BlockchainSyncBaseModule } from '@app/blockchain-sync';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserConsumer } from './user.consumer';
import { UserProducer } from './user.producer';
import { UserService } from './user.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('blockchain-sync-user'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.USER),
    HttpModule,
    BlockchainSyncBaseModule.register('blockchain/user'),
  ],
  providers: [UserService, UserProducer, UserConsumer],
})
export class BlockchainSyncUserModule {}
