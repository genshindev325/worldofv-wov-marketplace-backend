import { HttpService } from '@nestjs/axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { CreateAssetJobData } from './create-asset-job-data.type';
import { ImageThumbnailGenerationService } from './image-thumbnail-generation.service';
import { ImageThumbnailService } from './image-thumbnail.service';

@Processor('thumbnail/image', {
  concurrency:
    Number(process.env.IMAGE_THUMBNAIL_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class ImageThumbnailConsumer extends WorkerHost {
  protected readonly logger = new Logger(ImageThumbnailConsumer.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly thumbnailService: ImageThumbnailService,
    private readonly generationService: ImageThumbnailGenerationService,
  ) {
    super();
  }

  async process({ data }: Job<CreateAssetJobData>) {
    const response = await lastValueFrom(
      this.httpService.get(data.url, { responseType: 'arraybuffer' }),
    );

    const payload = await this.generationService.convertImage(
      response.data,
      data.size,
    );

    if (!payload) {
      this.logger.log(`Skipping thumbnail creation for size '${data.size}'.`);
      return;
    }

    const path = await this.thumbnailService.uploadMedia(payload, data);
    this.logger.log(`Successfully uploaded thumbnail to ${path}`);
  }
}
