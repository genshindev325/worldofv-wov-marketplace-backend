import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  CollectionActivityServiceClient,
  COLLECTION_ACTIVITY_SERVICE_NAME,
  TokenActivityServiceClient,
  TOKEN_ACTIVITY_SERVICE_NAME,
  UserActivityServiceClient,
  USER_ACTIVITY_SERVICE_NAME,
} from '@generated/ts-proto/services/activity';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { GetActivityResponse } from 'apps/gateway/src/activity/activity.response';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { GetCollectionActivityArgs } from './collection-activity.args';
import { GetLastTransfersForCollectionResponse } from './get-last-transfers-for-collection.response';
import { GetRecepientCountForCollectionResponse } from './get-recepient-count-for-collection.response';
import { GetTokenActivityArgs } from './token-activity.args';
import { GetUserActivityArgs } from './user-activity.args';

@Resolver()
export class ActivityResolver implements OnModuleInit {
  private readonly logger = new Logger(ActivityResolver.name);

  private grpcUserActivity: UserActivityServiceClient;
  private grpcCollectionActivity: CollectionActivityServiceClient;
  private grpcTokenActivity: TokenActivityServiceClient;

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_USER_ACTIVITY_CACHE_TTL) || 0;

  constructor(
    @Inject(GrpcClientKind.ACTIVITY)
    private readonly activityClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcUserActivity = this.activityClient.getService(
      USER_ACTIVITY_SERVICE_NAME,
    );
    this.grpcCollectionActivity = this.activityClient.getService(
      COLLECTION_ACTIVITY_SERVICE_NAME,
    );
    this.grpcTokenActivity = this.activityClient.getService(
      TOKEN_ACTIVITY_SERVICE_NAME,
    );
  }

  @Query(() => GetActivityResponse)
  @CacheControl(ActivityResolver.CACHE_TTL)
  async getUserActivity(@Args() args: GetUserActivityArgs) {
    return lastValueFrom(this.grpcUserActivity.getActivity(args));
  }

  @Query(() => GetActivityResponse)
  @CacheControl(ActivityResolver.CACHE_TTL)
  async getCollectionActivity(@Args() args: GetCollectionActivityArgs) {
    return lastValueFrom(this.grpcCollectionActivity.getActivity(args));
  }

  @Query(() => GetActivityResponse)
  @CacheControl(ActivityResolver.CACHE_TTL)
  async getTokenActivity(@Args() args: GetTokenActivityArgs) {
    return lastValueFrom(this.grpcTokenActivity.getActivity(args));
  }

  @Query(() => GetRecepientCountForCollectionResponse)
  @CacheControl(ActivityResolver.CACHE_TTL)
  async getRecepientCountForCollection(
    @Args() args: GetCollectionActivityArgs,
  ) {
    return lastValueFrom(
      this.grpcCollectionActivity.getRecepientCountForCollection(args),
    );
  }

  @Query(() => GetLastTransfersForCollectionResponse)
  @CacheControl(ActivityResolver.CACHE_TTL)
  async getLastTransfersForCollection(@Args() args: GetCollectionActivityArgs) {
    return lastValueFrom(
      this.grpcCollectionActivity.getLastTransfersForCollection(args),
    );
  }
}
