import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncUserModule } from './blockchain-sync-user.module';

bootstrapHybridService({
  Module: BlockchainSyncUserModule,
  httpPortKey: 'BLOCKCHAIN_SYNC_USER_SERVICE_PORT',
  queueNames: ['blockchain/user'],
});
