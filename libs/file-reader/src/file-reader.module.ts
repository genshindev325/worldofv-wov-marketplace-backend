import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FileReaderService } from './file-reader.service';

@Module({
  providers: [FileReaderService],
  imports: [HttpModule],
  exports: [FileReaderService],
})
export class FileReaderModule {}
