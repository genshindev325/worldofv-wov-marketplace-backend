import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainStatsModule } from './blockchain-stats.module';

bootstrapHybridService({
  Module: BlockchainStatsModule,
  grpcClientKind: GrpcClientKind.BLOCKCHAIN_STATS,
  httpPortKey: 'BLOCKCHAIN_STATS_SERVICE_PORT',
});
