import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import {
  MinimumOfferServiceClient,
  MINIMUM_OFFER_SERVICE_NAME,
} from '@generated/ts-proto/services/offer';
import { User } from '@generated/ts-proto/types/user';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { MinimumOfferDTO } from './minimum-offer.entity';
import {
  GetMinimumOffersForUserArgs,
  UpsertMinimumOfferArgs,
} from './minimum-offers.args';

@Resolver()
export class MinimumOffersResolver implements OnModuleInit {
  private readonly logger = new Logger(MinimumOffersResolver.name);

  private grpcMinimumOffer: MinimumOfferServiceClient;

  constructor(
    @Inject(GrpcClientKind.OFFER)
    private readonly offerClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcMinimumOffer = this.offerClient.getService(
      MINIMUM_OFFER_SERVICE_NAME,
    );
  }

  @Query(() => [MinimumOfferDTO])
  @CacheControl(0)
  async getMinimumOffersForUser(@Args() args: GetMinimumOffersForUserArgs) {
    const { items } = await lastValueFrom(
      this.grpcMinimumOffer.findMinimumOffersForUser(args),
    );

    return items || [];
  }

  @UseGuards(GqlUserGuard)
  @Mutation(() => MinimumOfferDTO)
  async upsertMinimumOffer(
    @Args() args: UpsertMinimumOfferArgs,
    @CurrentUser() user: User,
  ) {
    return lastValueFrom(
      this.grpcMinimumOffer.upsert({ ...args, userAddress: user.address }),
    );
  }
}
