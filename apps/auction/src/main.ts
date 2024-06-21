import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { AuctionModule } from './auction.module';

bootstrapHybridService({
  Module: AuctionModule,
  grpcClientKind: GrpcClientKind.AUCTION,
  httpPortKey: 'AUCTION_SERVICE_PORT',
});
