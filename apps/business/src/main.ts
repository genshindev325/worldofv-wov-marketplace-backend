import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BusinessModule } from './business.module';

bootstrapHybridService({
  Module: BusinessModule,
  grpcClientKind: GrpcClientKind.BUSINESS,
  httpPortKey: 'BUSINESS_SERVICE_PORT',
});
