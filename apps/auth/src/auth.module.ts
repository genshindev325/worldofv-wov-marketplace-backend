import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { AppJwtModule } from '@app/login';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { MetricsController } from 'common/metrics.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TracingModule.register('auth'),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.USER),
    AppJwtModule,
  ],
  controllers: [AuthController, MetricsController],
  providers: [AuthService],
})
export class AuthModule {}
