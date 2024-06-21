import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  AplosStatsServiceClient,
  APLOS_STATS_SERVICE_NAME,
} from '@generated/ts-proto/services/aplos_stats';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { GetBuyersStatsResponse } from './get-buyers-stats.response';
import { GetCollectionsStatsArgs } from './get-collections-stats.args';
import { GetCollectionsStatsResponse } from './get-collections-stats.response';
import { GetCurrentMonthFeesResponse } from './get-current-month.fees.response';

@Resolver()
export class AplosStatsResolver implements OnModuleInit {
  private readonly logger = new Logger(AplosStatsResolver.name);

  private grpcAplosStats: AplosStatsServiceClient;

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_USER_ACTIVITY_CACHE_TTL) || 0;

  constructor(
    @Inject(GrpcClientKind.APLOS_STATS)
    private readonly aplosClient: ClientGrpc,
  ) {}
  onModuleInit() {
    this.grpcAplosStats = this.aplosClient.getService(APLOS_STATS_SERVICE_NAME);
  }

  @Query(() => GetCollectionsStatsResponse)
  @CacheControl(0)
  async getCollectionsStats(@Args() args: GetCollectionsStatsArgs) {
    return lastValueFrom(this.grpcAplosStats.getCollectionsStats(args));
  }

  @Query(() => GetBuyersStatsResponse)
  @CacheControl(0)
  async getBuyersStats(@Args() args: GetCollectionsStatsArgs) {
    return lastValueFrom(this.grpcAplosStats.getBuyersStats(args));
  }

  @Query(() => GetCurrentMonthFeesResponse)
  @CacheControl(AplosStatsResolver.CACHE_TTL)
  async getCurrentMonthFees() {
    return lastValueFrom(this.grpcAplosStats.getCurrentMonthFees({}));
  }
}
