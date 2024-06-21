import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { SaleModule } from './sale.module';

bootstrapHybridService({
  Module: SaleModule,
  grpcClientKind: GrpcClientKind.SALE,
  httpPortKey: 'SALE_SERVICE_PORT',
});
