import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { EmailModule } from './email.module';

bootstrapHybridService({
  Module: EmailModule,
  grpcClientKind: GrpcClientKind.EMAIL,
  httpPortKey: 'EMAIL_SERVICE_PORT',
});
