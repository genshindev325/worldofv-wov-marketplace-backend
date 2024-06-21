import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  AuctionServiceClient,
  AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/auction';
import { Inject, OnModuleInit } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, map } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { AuctionDTO } from './auction.response';
import { GetAuctionHistoryArgs } from './get-auction-history.args';
import { AuctionHistory } from './get-auction-history.response';

@Resolver(() => AuctionDTO)
export class AuctionsResolver implements OnModuleInit {
  private grpcAuction: AuctionServiceClient;

  constructor(
    @Inject(GrpcClientKind.AUCTION)
    private readonly auctionClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcAuction = this.auctionClient.getService(AUCTION_SERVICE_NAME);
  }

  @Query(() => [AuctionHistory], { nullable: true })
  @CacheControl(0)
  async auctionHistory(@Args() args: GetAuctionHistoryArgs) {
    return lastValueFrom(
      this.grpcAuction.history(args).pipe(map((res) => res.history)),
    );
  }
}
