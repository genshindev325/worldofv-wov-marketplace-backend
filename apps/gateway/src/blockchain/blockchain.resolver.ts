import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import { REDIS_PUB_SUB } from '@app/redis-client';
import {
  BlockchainStatsServiceClient,
  BLOCKCHAIN_STATS_SERVICE_NAME,
} from '@generated/ts-proto/services/blockchain_stats';
import { Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import CacheControl from '../cache-control.decorator';
import { BlockchainEvent } from './blockchain-event.response';
import { CheckTransactionArgs } from './check-transaction.args';
import { GetSalesVolumeArgs } from './get-sales-volume.args';
import { GetSalesVolumeResult } from './get-sales-volume.response';

@Resolver()
export class BlockchainResolver implements OnModuleInit {
  private grpcBlockchainStats: BlockchainStatsServiceClient;

  constructor(
    @Inject(REDIS_PUB_SUB)
    private readonly pubSub: RedisPubSub,

    @Inject(GrpcClientKind.BLOCKCHAIN_STATS)
    private readonly blockchainStatsClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcBlockchainStats = this.blockchainStatsClient.getService(
      BLOCKCHAIN_STATS_SERVICE_NAME,
    );
  }

  @Subscription(() => BlockchainEvent, {
    resolve: (value: BlockchainEvent) => value,
    filter: (payload: BlockchainEvent, args: CheckTransactionArgs) =>
      args.txID === payload.meta.txID &&
      (!args.eventNames || args.eventNames.includes(payload.event)),
  })
  checkTransaction(@Args() args: CheckTransactionArgs) {
    return this.pubSub.asyncIterator('EventProcessed');
  }

  @UseGuards(GqlAdminGuard)
  @Query(() => GetSalesVolumeResult)
  @CacheControl(0)
  getSalesVolume(@Args() args: GetSalesVolumeArgs) {
    return this.grpcBlockchainStats.getSalesVolume(args);
  }
}
