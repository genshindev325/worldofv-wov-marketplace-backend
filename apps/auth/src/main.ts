import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { AuthModule } from './auth.module';

bootstrapHybridService({
  Module: AuthModule,
  grpcClientKind: GrpcClientKind.AUTH,
  httpPortKey: 'AUTH_SERVICE_PORT',
});
