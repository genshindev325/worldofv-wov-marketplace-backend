import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  OfferAggregationServiceClient,
  OFFER_AGGREGATION_SERVICE_NAME,
  UserOfferType,
} from '@generated/ts-proto/services/offer';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import { lastValueFrom, map } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { GetOffersForTokenArgs, GetOffersForUserArgs } from './get-offers.args';
import { GetOffersForUserResponse } from './get-offers.response';
import { OfferDTO } from './offer.response';

@Resolver(() => OfferDTO)
export class OffersResolver implements OnModuleInit {
  private readonly logger = new Logger(OffersResolver.name);

  private static readonly CACHE_TTL =
    Number(process.env.GATEWAY_SYNC_CACHE_TTL) || 0;

  private grpcOfferAggregation: OfferAggregationServiceClient;

  constructor(
    @Inject(GrpcClientKind.OFFER)
    private readonly offerClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcOfferAggregation = this.offerClient.getService(
      OFFER_AGGREGATION_SERVICE_NAME,
    );
  }

  @Query(() => [OfferDTO])
  @CacheControl(OffersResolver.CACHE_TTL)
  async getOffersForToken(
    @Args() args: GetOffersForTokenArgs,
  ): Promise<OfferDTO[]> {
    return lastValueFrom(
      this.grpcOfferAggregation
        .getOffersForToken(args)
        .pipe(map(({ offers }) => (offers || []) as OfferDTO[])),
    );
  }

  @Query(() => GetOffersForUserResponse)
  @CacheControl(OffersResolver.CACHE_TTL)
  async getOffersForUser(
    @Args() args: GetOffersForUserArgs,
  ): Promise<GetOffersForUserResponse> {
    const result = await lastValueFrom(
      this.grpcOfferAggregation.getOffersForUser({
        ...args,
        type: args.type as string as UserOfferType,
      }),
    );
    return result as GetOffersForUserResponse;
  }

  @ResolveField()
  async currency(@Parent() offer: Exclude<OfferDTO, 'currency'>) {
    return getPaymentFromContractAddress(offer.addressVIP180);
  }
}
