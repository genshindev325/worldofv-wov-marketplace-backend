import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { MetadataService } from './metadata.service';

@Controller()
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('/token/:address/:id')
  async metadata(@Param('address') address: string, @Param('id') id: string) {
    try {
      return await this.metadataService.getMetadata(address, id);
    } catch (error) {
      if (
        error instanceof ExtendedRpcException &&
        error.code === GrpcStatus.NOT_FOUND
      ) {
        throw new HttpException('Token not found.', HttpStatus.NOT_FOUND);
      } else {
        throw error;
      }
    }
  }
}
