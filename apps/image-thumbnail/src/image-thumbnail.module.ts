import { GrpcOptionsModule } from '@app/grpc-options';
import { RedisBullModule, RedisClientModule } from '@app/redis-client';
import { S3Module } from '@app/s3';
import { TracingModule } from '@app/tracing';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client/image-thumbnail';
import { MetricsController } from 'common/metrics.controller';
import { ImageThumbnailGenerationService } from './image-thumbnail-generation.service';
import { ImageThumbnailUploadService } from './image-thumbnail-upload.service';
import { ImageThumbnailConsumer } from './image-thumbnail.consumer';
import { ImageThumbnailController } from './image-thumbnail.controller';
import { ImageThumbnailService } from './image-thumbnail.service';
import { VideoThumbnailConsumer } from './video-thumbnail.consumer';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisClientModule,
    S3Module,
    HttpModule,
    RedisBullModule.register(),
    BullModule.registerQueue({ name: 'thumbnail/image' }),
    BullModule.registerQueue({ name: 'thumbnail/video' }),
    TracingModule.register('image-thumbnail'),
    GrpcOptionsModule,
  ],
  controllers: [ImageThumbnailController, MetricsController],
  providers: [
    ImageThumbnailService,
    ImageThumbnailGenerationService,
    ImageThumbnailUploadService,
    ImageThumbnailConsumer,
    VideoThumbnailConsumer,
    PrismaClient,
  ],
})
export class ImageThumbnailModule {}
