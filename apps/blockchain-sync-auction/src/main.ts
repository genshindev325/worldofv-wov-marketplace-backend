import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { BlockchainSyncAuctionModule } from './blockchain-sync-auction.module';

bootstrapHybridService({
  Module: BlockchainSyncAuctionModule,
  grpcClientKind: GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION,
  httpPortKey: 'BLOCKCHAIN_SYNC_AUCTION_SERVICE_PORT',
  queueNames: ['blockchain/auction'],
});
