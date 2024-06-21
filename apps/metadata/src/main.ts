import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { MetadataModule } from './metadata.module';

bootstrapHybridService({
  Module: MetadataModule,
  httpPortKey: 'METADATA_SERVICE_PORT',
});
