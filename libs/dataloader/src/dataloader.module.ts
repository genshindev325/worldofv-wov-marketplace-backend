import { GrpcClientModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { Module } from '@nestjs/common';
import { DataloaderService } from './dataloader.service';

@Module({
  imports: [GrpcClientModule.register(GrpcClientKind.IMAGE_THUMBNAIL)],
  providers: [DataloaderService],
  exports: [DataloaderService],
})
export class DataloaderModule {}
