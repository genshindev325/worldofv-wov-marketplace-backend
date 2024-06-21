import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { NftImportModule } from './nft-import.module';

bootstrapHybridService({
  Module: NftImportModule,
  grpcClientKind: GrpcClientKind.NFT_IMPORT,
  httpPortKey: 'NFT_IMPORT_SERVICE_PORT',
  queueNames: ['nft-import/smart-contract', 'nft-import/staking-contract'],
});
