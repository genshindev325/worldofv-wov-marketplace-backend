import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncStakeModule } from './blockchain-sync-stake.module';

bootstrapHybridService({
  Module: BlockchainSyncStakeModule,
  grpcClientKind: GrpcClientKind.BLOCKCHAIN_SYNC_STAKE,
  httpPortKey: 'BLOCKCHAIN_SYNC_STAKE_SERVICE_PORT',
  queueNames: ['blockchain/stake'],
});
