import {
  CreateHomeBannerArgs,
  DeleteHomeBannerArgs,
  HomeBannerServiceController,
  HomeBannerServiceControllerMethods,
  UpdateHomeBannerArgs,
} from '@generated/ts-proto/services/admin';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { HomeBannerService } from './home-banner.service';

@Controller()
@HomeBannerServiceControllerMethods()
export class HomeBannerController implements HomeBannerServiceController {
  constructor(private readonly homeBannerService: HomeBannerService) {}

  async getAll() {
    const banners = await this.homeBannerService.findMany({
      orderBy: [{ position: 'asc' }],
    });

    return { banners };
  }

  async create(args: CreateHomeBannerArgs) {
    return this.homeBannerService.create(args);
  }

  async update(args: UpdateHomeBannerArgs) {
    const banner = await this.homeBannerService.update(args);

    if (!banner) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find banner "${args.id}"`,
      });
    }

    return banner;
  }

  async delete(args: DeleteHomeBannerArgs) {
    const deleted = await this.homeBannerService.delete(args.id);
    return { value: !!deleted };
  }
}
