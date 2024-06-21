import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncSaleModule } from './blockchain-sync-sale.module';

bootstrapHybridService({
  Module: BlockchainSyncSaleModule,
  httpPortKey: 'BLOCKCHAIN_SYNC_SALE_SERVICE_PORT',
  queueNames: ['blockchain/sale'],
});
