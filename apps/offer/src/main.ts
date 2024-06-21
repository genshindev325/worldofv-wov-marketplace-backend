import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { OfferModule } from './offer.module';

bootstrapHybridService({
  Module: OfferModule,
  grpcClientKind: GrpcClientKind.OFFER,
  httpPortKey: 'OFFER_SERVICE_PORT',
});
