import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

import fs from 'fs';
import stream from 'stream';
import validator from 'validator';

import { HttpService } from '@nestjs/axios';
import { Source } from './file-reader.type';

@Injectable()
export class FileReaderService {
  private readonly logger = new Logger(FileReaderService.name);

  constructor(private readonly httpService: HttpService) {}

  public async sourceToBuffer(source: Source): Promise<Buffer> {
    switch (typeof source) {
      case 'object':
        if (
          source instanceof fs.ReadStream ||
          source instanceof stream.PassThrough
        ) {
          return await this.fromStream(source);
        } else if (source instanceof Buffer) {
          return await this.fromBuffer(source);
        } else {
          return await this.fromUri(source.uri);
        }
      case 'string':
        if (validator.isBase64(source)) {
          return await this.fromBase64(source);
        } else {
          return await this.fromPath(source);
        }
    }
  }

  public async fromStream(
    stream: fs.ReadStream | stream.PassThrough,
  ): Promise<Buffer> {
    const imageBuffer = this.streamToBuffer(stream);
    return imageBuffer;
  }

  public async fromUri(uri: string): Promise<Buffer> {
    try {
      const observable$ = this.httpService.get(uri, {
        responseType: 'arraybuffer',
      });

      const response = await lastValueFrom(observable$);
      const imageBuffer = Buffer.from(response.data, 'binary');

      return imageBuffer;
    } catch (err) {
      this.logger.error('fileReaderHelper.fromUri', uri, err);
    }

    return Buffer.from([]);
  }

  public async fromBuffer(buffer: Buffer): Promise<Buffer> {
    return buffer;
  }

  public async fromBase64(base64: string): Promise<Buffer> {
    const imageBuffer = Buffer.from(base64, 'base64');
    return imageBuffer;
  }

  public async fromPath(path: string): Promise<Buffer> {
    const imageBuffer = fs.readFileSync(path);
    return imageBuffer;
  }

  private async streamToBuffer(
    stream: fs.ReadStream | stream.PassThrough,
  ): Promise<Buffer> {
    return new Promise((resolve) => {
      const buffers: any[] = [];

      stream.on('data', (data: string | Buffer) => {
        buffers.push(data);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }
}
