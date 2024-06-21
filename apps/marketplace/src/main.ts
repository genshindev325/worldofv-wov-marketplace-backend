import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { MarketplaceModule } from './marketplace.module';

bootstrapHybridService({
  Module: MarketplaceModule,
  grpcClientKind: GrpcClientKind.MARKETPLACE,
  httpPortKey: 'MARKETPLACE_SERVICE_PORT',
});
