import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/admin';
import { MetricsController } from 'common/metrics.controller';
import { HomeBannerController } from './banner/home-banner.controller';
import { HomeBannerService } from './banner/home-banner.service';
import { HomeCollectionController } from './home-collection/home-collection.controller';
import { HomeCollectionService } from './home-collection/home-collection.service';
import { TopUserController } from './top-user/top-user.controller';
import { TopUserService } from './top-user/top-user.service';
import { VerifiedDropController } from './verified-drop/verified-drop.controller';
import { VerifiedDropService } from './verified-drop/verified-drop.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TracingModule.register('admin'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.USER,
      GrpcClientKind.NFT,
      GrpcClientKind.IMAGE_THUMBNAIL,
    ),
  ],
  controllers: [
    HomeBannerController,
    VerifiedDropController,
    TopUserController,
    HomeCollectionController,
    MetricsController,
  ],
  providers: [
    PrismaClient,

    HomeBannerService,
    VerifiedDropService,
    TopUserService,
    HomeCollectionService,
  ],
})
export class AdminModule {}
