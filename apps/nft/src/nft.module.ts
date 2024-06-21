import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisBullModule, RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { ContractModule } from '@blockchain/contract';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/nft';
import { MetricsController } from 'common/metrics.controller';
import { BrandModule } from './brand/brand.module';
import { CollectionModule } from './collection/collection.module';
import { EditionModule } from './edition/edition.module';
import { TokenModule } from './token/token.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisClientModule,
    TracingModule.register('nft'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.IMAGE_THUMBNAIL),
    RedisBullModule.register(),
    ContractModule,
    TokenModule,
    EditionModule,
    CollectionModule,
    BrandModule,
  ],
  providers: [PrismaClient],
  controllers: [MetricsController],
  exports: [ClientsModule, RedisClientModule, BullModule, PrismaClient],
})
export class NftModule {}
