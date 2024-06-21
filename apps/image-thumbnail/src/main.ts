import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import bootstrapHybridService from 'common/bootstrap-hybrid-service';
import { ImageThumbnailModule } from './image-thumbnail.module';

bootstrapHybridService({
  Module: ImageThumbnailModule,
  grpcClientKind: GrpcClientKind.IMAGE_THUMBNAIL,
  httpPortKey: 'IMAGE_THUMBNAIL_SERVICE_PORT',
  queueNames: ['thumbnail/image', 'thumbnail/video'],
});
