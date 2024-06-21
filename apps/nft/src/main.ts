import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { NftModule } from './nft.module';

bootstrapHybridService({
  Module: NftModule,
  grpcClientKind: GrpcClientKind.NFT,
  httpPortKey: 'NFT_SERVICE_PORT',
  queueNames: ['nft/collection/resync'],
});
