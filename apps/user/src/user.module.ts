import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { RedisClientModule } from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/user';
import { MetricsController } from 'common/metrics.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisClientModule,
    GrpcOptionsModule,
    TracingModule.register('user'),
    GrpcClientModule.register(GrpcClientKind.IMAGE_THUMBNAIL),
  ],
  controllers: [UserController, MetricsController],
  providers: [PrismaClient, UserService],
})
export class UserModule {}
