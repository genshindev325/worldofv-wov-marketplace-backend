import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Credentials, Endpoint, S3 } from 'aws-sdk';
import { S3Service } from './s3.service';

export const S3_CLIENT = Symbol('S3_CLIENT');

const s3Provider = {
  inject: [ConfigService],
  provide: S3_CLIENT,
  useFactory: (configService: ConfigService) => {
    const originEndpoint = configService.getOrThrow('S3_BUCKET_ENDPOINT');
    const accessKeyId = configService.getOrThrow('S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.getOrThrow('S3_SECRET_ACCESS_KEY');
    const region = configService.getOrThrow('S3_REGION');

    return new S3({
      endpoint: new Endpoint(originEndpoint),
      signatureVersion: 'v4',
      region,
      credentials: new Credentials({ accessKeyId, secretAccessKey }),
      s3BucketEndpoint: true,
    });
  },
};

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [s3Provider, S3Service],
  exports: [s3Provider, S3Service],
})
export class S3Module {}
