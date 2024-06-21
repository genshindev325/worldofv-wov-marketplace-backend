import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GrpcOptionsService } from './grpc-options.service';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [GrpcOptionsService],
  exports: [GrpcOptionsService],
})
export class GrpcOptionsModule {}
