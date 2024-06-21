import { FileReaderService } from '@app/file-reader';
import { S3Service } from '@app/s3';
import { Injectable, Logger } from '@nestjs/common';
import { generateChecksum } from 'common/checksum.helper';
import { fromBuffer } from 'file-type';
import { v4 } from 'uuid';
import { UploadFileArgs, UploadFileGqlArgs, UploadFileUrlArgs } from '../types';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly s3: S3Service,
    private readonly fileReaderService: FileReaderService,
  ) {}

  async uploadGql({
    file,
    ...args
  }: UploadFileGqlArgs): Promise<string | undefined> {
    try {
      if (file) {
        // Convert the promise in plain object
        file = await file;

        // Convert the file to stream and then to buffer
        // TODO: check why type definitions do not match
        const fileStream: any = file.createReadStream();
        const fileBuffer = await this.fileReaderService.fromStream(fileStream);

        return await this.upload({ fileBuffer, ...args });
      }
    } catch (err) {
      this.logger.warn(`An error occurred while uploading the file`, err);
    }

    return undefined;
  }

  async uploadUrl({
    url,
    ...args
  }: UploadFileUrlArgs): Promise<string | undefined> {
    try {
      // Convert the file from URL to Buffer
      const fileBuffer = await this.fileReaderService.fromUri(url);

      return await this.upload({ fileBuffer, ...args });
    } catch (err) {
      this.logger.warn(`An error occurred while uploading the file`, err);
    }

    return undefined;
  }

  async upload({
    fileBuffer,
    path,
    previousUrl,
  }: UploadFileArgs): Promise<string | undefined> {
    try {
      // Get the image checksum to use as fileName
      const fileChecksum = generateChecksum(fileBuffer);

      // Check the fileChecksum with the previous one if exists in order to skip the upload if necessary
      if (previousUrl) {
        const [, previousFileChecksum] =
          previousUrl.match(/.*\/(.+)+?\./) || [];

        if (previousFileChecksum === fileChecksum) {
          this.logger.warn(
            `Skipping the upload because a file with the same checksum was found ${fileChecksum}`,
          );

          return undefined;
        }
      }

      // Get the file info
      const { ext, mime: mimeType } = await fromBuffer(fileBuffer);

      // Upload the thumbnail to S3
      const uploadResult = await this.s3.putObject({
        path,
        mimeType,
        fileName: `${fileChecksum || v4()}.${ext}`,
        file: fileBuffer,
      });

      if (uploadResult) {
        // If a thumbnailImageUrl already exists, delete the old one
        if (previousUrl) {
          const exists = await this.s3.objectExists({ path: previousUrl });

          if (exists) {
            await this.s3.deleteObject({
              path: previousUrl,
            });
          }
        }

        return uploadResult?.Location;
      }
    } catch (err) {
      this.logger.warn(`An error occurred while uploading the file`, err);
    }

    return undefined;
  }
}
