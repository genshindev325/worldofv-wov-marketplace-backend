import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncPfpModule } from './blockchain-sync-pfp.module';

bootstrapHybridService({
  Module: BlockchainSyncPfpModule,
  grpcClientKind: GrpcClientKind.BLOCKCHAIN_SYNC_PFP,
  httpPortKey: 'BLOCKCHAIN_SYNC_PFP_SERVICE_PORT',
  queueNames: ['blockchain/pfp'],
});
