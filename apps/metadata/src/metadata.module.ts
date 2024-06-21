import { GrpcClientModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetadataController } from './metadata.controller';
import { MetadataService } from './metadata.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GrpcClientModule.register(GrpcClientKind.NFT),
    TracingModule.register('metadata'),
  ],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
