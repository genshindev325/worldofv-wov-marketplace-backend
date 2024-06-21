import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { UserModule } from './user.module';

bootstrapHybridService({
  Module: UserModule,
  grpcClientKind: GrpcClientKind.USER,
  httpPortKey: 'USER_SERVICE_PORT',
});
