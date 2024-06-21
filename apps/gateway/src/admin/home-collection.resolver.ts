import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  HomeCollectionServiceClient,
  HOME_COLLECTION_SERVICE_NAME,
} from '@generated/ts-proto/services/admin';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import {
  DeleteHomeCollectionArgs,
  UpsertHomeCollectionArgs,
} from './/home-collection.args';
import { HomeCollection } from './home-collection.response';

@Resolver()
export class HomeCollectionResolver implements OnModuleInit {
  private readonly logger = new Logger(HomeCollectionResolver.name);

  private grpcHomeCollection: HomeCollectionServiceClient;

  constructor(
    @Inject(GrpcClientKind.ADMIN)
    private readonly adminClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcHomeCollection = this.adminClient.getService(
      HOME_COLLECTION_SERVICE_NAME,
    );
  }

  @Query(() => [HomeCollection])
  @CacheControl(0)
  async getHomeCollections() {
    const { collections } = await lastValueFrom(
      this.grpcHomeCollection.getAll(null),
    );

    return collections || [];
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => HomeCollection)
  async upsertHomeCollection(@Args() args: UpsertHomeCollectionArgs) {
    return lastValueFrom(this.grpcHomeCollection.upsert(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async deleteHomeCollection(@Args() args: DeleteHomeCollectionArgs) {
    const { value: deleted } = await lastValueFrom(
      this.grpcHomeCollection.delete(args),
    );

    return deleted;
  }
}
