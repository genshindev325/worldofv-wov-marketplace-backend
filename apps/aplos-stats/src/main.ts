import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { AplosStatsModule } from './aplos-stats.module';

bootstrapHybridService({
  Module: AplosStatsModule,
  grpcClientKind: GrpcClientKind.APLOS_STATS,
  httpPortKey: 'APLOS_STATS_SERVICE_PORT',
});
