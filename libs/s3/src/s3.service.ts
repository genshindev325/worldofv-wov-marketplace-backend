import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { v4 } from 'uuid';
import { S3_CLIENT } from './s3.module';
import { S3DeleteObject, S3GetObject, S3PutObject } from './s3.type';

/**
 * @deprecated Inject S3_CLIENT directly instead.
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  private bucketName: string;

  constructor(@Inject(forwardRef(() => S3_CLIENT)) private readonly s3: S3) {
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  private getBaseUrl = (bucket: string) => {
    return this.s3.endpoint.host + bucket;
  };

  public async getObject({
    key,
    bucketName,
  }: S3GetObject): Promise<string | undefined> {
    const params = {
      Bucket: bucketName || this.bucketName,
      Key: key,
    };

    return this.s3.getSignedUrlPromise('getObject', params);
  }

  public async putObject({
    path,
    fileName,
    file,
    mimeType,
    bucketName,
  }: S3PutObject): Promise<S3.ManagedUpload.SendData> {
    const normalizedPath = path
      ? `${path.replace(/^\//, '').replace(/\/$/, '')}/`
      : '';

    const key = `${normalizedPath}${fileName || v4()}`;

    const params = {
      Bucket: bucketName || this.bucketName,
      Key: key,
      Body: file,
      ContentType: mimeType,
      ContentDisposition: 'inline',
      ACL: 'public-read',
    };

    const response = await this.s3.upload(params).promise();

    // There is a bug in the AWS SDK where sometimes the returned URL does not
    // have the protocol specified.
    if (!/^http[s]?:\/\//.test(response.Location)) {
      response.Location = 'https://' + response.Location;
    }

    return response;
  }

  public async deleteObject({
    path,
    key,
    bucketName,
  }: S3DeleteObject): Promise<any> {
    const bucket = bucketName || this.bucketName;
    const baseUrl = this.getBaseUrl(bucket);

    const fullPath = path.substring(path.indexOf(baseUrl) + baseUrl.length);

    const params = {
      Bucket: bucket,
      Key: key ? key : fullPath,
    };

    this.logger.log(`Deleting "${params.Key}" from "${params.Bucket}"`);

    return this.s3.deleteObject(params).promise();
  }

  public async objectExists({ path, key, bucketName }: any): Promise<boolean> {
    const bucket = bucketName || this.bucketName;
    const baseUrl = this.getBaseUrl(bucket);

    const fullPath = path.substring(path.indexOf(baseUrl) + baseUrl.length);

    const params = {
      Bucket: bucket,
      Key: key ? key : fullPath,
    };

    try {
      await this.s3.headObject(params).promise();
      return true;
    } catch (err) {
      this.logger.error(err);
    }

    return false;
  }
}
