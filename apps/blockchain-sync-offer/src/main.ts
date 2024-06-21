import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncOfferModule } from './blockchain-sync-offer.module';

bootstrapHybridService({
  Module: BlockchainSyncOfferModule,
  httpPortKey: 'BLOCKCHAIN_SYNC_OFFER_SERVICE_PORT',
  queueNames: ['blockchain/offer'],
});
