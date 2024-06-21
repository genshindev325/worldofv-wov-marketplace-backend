import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheModule } from '@app/price-conversion-cache';
import { TracingModule } from '@app/tracing';
import { Web3Module } from '@app/web3';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/marketplace';
import { MetricsController } from 'common/metrics.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    Web3Module,
    PriceConversionCacheModule,
    TracingModule.register('marketplace'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.USER,
      GrpcClientKind.NFT,
      GrpcClientKind.SALE,
      GrpcClientKind.AUCTION,
      GrpcClientKind.IMAGE_THUMBNAIL,
      GrpcClientKind.OFFER,
    ),
  ],
  controllers: [MarketplaceController, MetricsController],
  providers: [PrismaClient, MarketplaceService],
})
export class MarketplaceModule {}
