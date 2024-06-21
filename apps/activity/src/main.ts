import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { ActivityModule } from './activity.module';

bootstrapHybridService({
  Module: ActivityModule,
  grpcClientKind: GrpcClientKind.ACTIVITY,
  httpPortKey: 'ACTIVITY_SERVICE_PORT',
});
