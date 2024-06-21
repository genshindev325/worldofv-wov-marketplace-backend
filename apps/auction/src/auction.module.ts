import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client/auction';
import { MetricsController } from 'common/metrics.controller';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TracingModule.register('auction'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.USER,
      GrpcClientKind.NFT,
      GrpcClientKind.IMAGE_THUMBNAIL,
      GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION,
      GrpcClientKind.EMAIL,
    ),
    RedisClientModule,
  ],
  controllers: [AuctionController, MetricsController],
  providers: [PrismaClient, AuctionService],
})
export class AuctionModule {}
