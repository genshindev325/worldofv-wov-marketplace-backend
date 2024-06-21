import { FileUploadService } from '@app/file-upload';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  BrandServiceClient,
  BRAND_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { CacheTTL, Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Brand } from './brand.response';
import { UpsertBrandArgs } from './upsert-brand.args';

@Resolver()
export class BrandResolver implements OnModuleInit {
  private static readonly CACHE_TTL = Number(
    process.env.GATEWAY_SLOW_CACHE_TTL || 0,
  );

  private grpcBrand: BrandServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    private readonly fileUploadService: FileUploadService,
  ) {}

  onModuleInit() {
    this.grpcBrand = this.nftClient.getService(BRAND_SERVICE_NAME);
  }

  @Query(() => [Brand])
  @CacheTTL(BrandResolver.CACHE_TTL)
  async getAllBrands() {
    const data = await lastValueFrom(this.grpcBrand.getAll(null));
    return data.brands || [];
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Brand)
  async upsertBrand(@Args() args: UpsertBrandArgs) {
    return await lastValueFrom(this.grpcBrand.upsert(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Brand)
  async deleteBrand(@Args('id') id: string) {
    return await lastValueFrom(this.grpcBrand.delete({ id }));
  }
}
