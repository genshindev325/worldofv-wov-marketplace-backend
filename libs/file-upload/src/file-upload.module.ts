import { FileReaderModule } from '@app/file-reader';
import { S3Module } from '@app/s3';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileUploadService } from './file-upload.service';

@Module({
  imports: [ConfigModule.forRoot(), S3Module, FileReaderModule],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class FileUploadModule {}
