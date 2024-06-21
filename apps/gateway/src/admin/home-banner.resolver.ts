import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  HomeBannerServiceClient,
  HOME_BANNER_SERVICE_NAME,
} from '@generated/ts-proto/services/admin';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import {
  CreateHomeBannerArgs,
  DeleteHomeBannerArgs,
  UpdateHomeBannerArgs,
} from './home-banner.args';
import { HomeBanner } from './home-banner.response';

@Resolver()
export class HomeBannerResolver implements OnModuleInit {
  private readonly logger = new Logger(HomeBannerResolver.name);

  private grpcHomeBanner: HomeBannerServiceClient;

  constructor(
    @Inject(GrpcClientKind.ADMIN)
    private readonly adminClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcHomeBanner = this.adminClient.getService(HOME_BANNER_SERVICE_NAME);
  }

  @Query(() => [HomeBanner])
  @CacheControl(0)
  async getHomeBanners() {
    const { banners } = await lastValueFrom(this.grpcHomeBanner.getAll(null));

    return banners || [];
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => HomeBanner)
  async createHomeBanner(@Args() args: CreateHomeBannerArgs) {
    return lastValueFrom(this.grpcHomeBanner.create(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => HomeBanner)
  async updateHomeBanner(@Args() args: UpdateHomeBannerArgs) {
    return lastValueFrom(this.grpcHomeBanner.update(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async deleteHomeBanner(@Args() args: DeleteHomeBannerArgs) {
    const { value: deleted } = await lastValueFrom(
      this.grpcHomeBanner.delete(args),
    );

    return deleted;
  }
}
