import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { PriceConversionModule } from './price-conversion.module';

bootstrapHybridService({
  Module: PriceConversionModule,
  grpcClientKind: GrpcClientKind.PRICE_CONVERSION,
  httpPortKey: 'PRICE_CONVERSION_SERVICE_PORT',
});
