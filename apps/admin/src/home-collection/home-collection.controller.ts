import {
  DeleteHomeCollectionArgs,
  HomeCollection,
  HomeCollectionServiceController,
  HomeCollectionServiceControllerMethods,
} from '@generated/ts-proto/services/admin';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { HomeCollectionService } from './home-collection.service';

@Controller()
@HomeCollectionServiceControllerMethods()
export class HomeCollectionController
  implements HomeCollectionServiceController
{
  constructor(private readonly homeCollectionService: HomeCollectionService) {}

  async getAll() {
    const collections = await this.homeCollectionService.findMany({
      orderBy: { position: 'asc' },
    });

    return { collections };
  }

  async upsert(args: HomeCollection) {
    const collection = await this.homeCollectionService.upsert(args);

    if (!collection) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find collection "${args.id}"`,
      });
    }

    return collection;
  }

  async delete(args: DeleteHomeCollectionArgs) {
    const deleted = await this.homeCollectionService.delete(args.id);
    return { value: !!deleted };
  }
}
