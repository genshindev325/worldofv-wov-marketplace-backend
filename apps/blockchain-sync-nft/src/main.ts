import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncNftModule } from './blockchain-sync-nft.module';

bootstrapHybridService({
  Module: BlockchainSyncNftModule,
  httpPortKey: 'BLOCKCHAIN_SYNC_NFT_SERVICE_PORT',
  queueNames: ['blockchain/nft', 'blockchain/phygital'],
});
