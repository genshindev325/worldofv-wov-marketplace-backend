import { HttpService } from '@nestjs/axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { CreateAssetJobData } from './create-asset-job-data.type';
import { ImageThumbnailGenerationService } from './image-thumbnail-generation.service';
import { ImageThumbnailService } from './image-thumbnail.service';

@Processor('thumbnail/video', {
  concurrency:
    Number(process.env.VIDEO_THUMBNAIL_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class VideoThumbnailConsumer extends WorkerHost {
  protected readonly logger = new Logger(VideoThumbnailConsumer.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly imageThumbnailService: ImageThumbnailService,
    private readonly generationService: ImageThumbnailGenerationService,
  ) {
    super();
  }

  async process({ data }: Job<CreateAssetJobData>) {
    const response = await lastValueFrom(
      this.httpService.get(data.url, { responseType: 'arraybuffer' }),
    );

    const payload = await this.generationService.convertVideo(
      response.data,
      data.extension,
      data.size,
    );

    if (!payload) {
      this.logger.log(`Skipping thumbnail creation for size '${data.size}'.`);
      return;
    }

    const path = await this.imageThumbnailService.uploadMedia(payload, data);
    this.logger.log(`Successfully uploaded thumbnail to ${path}`);
  }
}
