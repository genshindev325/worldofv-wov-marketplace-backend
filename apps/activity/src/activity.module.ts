import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { ContractModule } from '@blockchain/contract';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/blockchain';
import { MetricsController } from 'common/metrics.controller';
import { ActivityService } from './activity.service';
import { CollectionActivityController } from './collection/collection-activity.controller';
import { CollectionActivityService } from './collection/collection-activity.service';
import { TokenActivityController } from './token/token-activity.controller';
import { TokenActivityService } from './token/token-activity.service';
import { UserActivityController } from './user/user-activity.controller';
import { UserActivityService } from './user/user-activity.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.register(),
    ContractModule,
    TracingModule.register('activity'),
    GrpcOptionsModule,
    GrpcClientModule.register(
      GrpcClientKind.USER,
      GrpcClientKind.NFT,
      GrpcClientKind.IMAGE_THUMBNAIL,
    ),
  ],
  controllers: [
    UserActivityController,
    CollectionActivityController,
    TokenActivityController,
    MetricsController,
  ],
  providers: [
    UserActivityService,
    CollectionActivityService,
    TokenActivityService,
    PrismaClient,
    ActivityService,
  ],
})
export class ActivityModule {}
