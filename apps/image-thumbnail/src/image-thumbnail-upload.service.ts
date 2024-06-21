import { S3_CLIENT } from '@app/s3';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { lastValueFrom } from 'rxjs';

export interface PutObjectRequest {
  Key: string;
  ACL: string;
  ContentDisposition: string;
  ContentType: string;
  Body: Buffer;
}

@Injectable()
export class ImageThumbnailUploadService {
  private readonly logger = new Logger(ImageThumbnailUploadService.name);

  readonly ORIGIN_ENDPOINT;
  readonly CDN_ENDPOINT;

  private readonly BUCKET_NAME;
  private readonly RETRY_TIMEOUT_MULTIPLIER = 1000;
  private readonly RETRY_COUNT = 10;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3,

    private readonly httpService: HttpService,

    configService: ConfigService,
  ) {
    this.BUCKET_NAME = configService.getOrThrow('S3_BUCKET_NAME');

    this.ORIGIN_ENDPOINT = configService
      .getOrThrow('S3_BUCKET_ENDPOINT')
      .replace(/\/$/, '');

    this.CDN_ENDPOINT = configService
      .getOrThrow('S3_CDN_ENDPOINT')
      .replace(/\/$/, '');
  }

  async headObject(request: Omit<S3.HeadObjectRequest, 'Bucket'>) {
    return this.s3
      .headObject({ Bucket: this.BUCKET_NAME, ...request })
      .promise();
  }

  async listObjects(request: Omit<S3.ListObjectsV2Request, 'Bucket'>) {
    // Sometimes the s3 service will return an error indicating there is
    // a slowdown to allow for the infrastructure to rescale, the recommended
    // approach is to employ an exponential backoff strategy when repeating
    // the request.
    // See https://docs.digitalocean.com/products/spaces/details/limits/

    let attempt = 0;

    for (;;) {
      try {
        return await this.s3
          .listObjectsV2({ Bucket: this.BUCKET_NAME, ...request })
          .promise();
      } catch (error) {
        if (error?.retryable) {
          attempt += 1;

          if (attempt > this.RETRY_COUNT) throw error;

          const timeout = this.RETRY_TIMEOUT_MULTIPLIER * attempt;

          this.logger.error(
            `[${this.listObjects.name}] Failed to fetch assets for '${request.Prefix}', retrying in ${timeout} (${attempt}/${this.RETRY_COUNT})`,
          );

          await new Promise((resolve) => setTimeout(resolve, timeout));

          continue;
        } else if (error?.code === 'Forbidden') {
          return null;
        } else {
          throw error;
        }
      }
    }
  }

  async putObject({ Body, ...request }: PutObjectRequest) {
    const url = await this.s3.getSignedUrlPromise('putObject', {
      Bucket: this.BUCKET_NAME,
      ...request,
    });

    // We use a raw upload instead of the managed s3 upload method because
    // there is a memory leak in the AWS SDK that makes the service crash.
    // See https://github.com/aws/aws-sdk-js/issues/3128

    await lastValueFrom(
      this.httpService.put(url, Body, {
        // These headers must match the getSignedUrlPromise configuration,
        // otherwise the signature will not match.
        headers: {
          'x-amz-acl': request.ACL,
          'content-disposition': request.ContentDisposition,
          'content-type': request.ContentType,
        },
      }),
    );
  }

  async deleteObjects(request: Omit<S3.DeleteObjectsRequest, 'Bucket'>) {
    return this.s3
      .deleteObjects({ Bucket: this.BUCKET_NAME, ...request })
      .promise();
  }
}
