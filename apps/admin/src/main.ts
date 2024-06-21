import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { AdminModule } from './admin.module';

bootstrapHybridService({
  Module: AdminModule,
  grpcClientKind: GrpcClientKind.ADMIN,
  httpPortKey: 'ADMIN_SERVICE_PORT',
});
