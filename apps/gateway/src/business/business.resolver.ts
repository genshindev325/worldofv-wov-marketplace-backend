import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard, GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import {
  BusinessServiceClient,
  BUSINESS_SERVICE_NAME,
} from '@generated/ts-proto/services/business';
import { User } from '@generated/ts-proto/types/user';
import { Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { Recaptcha } from '@nestlab/google-recaptcha';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import {
  AdminCreateClientArgs,
  CheckSecretCodeArgs,
  ConsumeSecretCodeArgs,
} from './business.args';

@Resolver()
export class BusinessResolver implements OnModuleInit {
  private grpcBusiness: BusinessServiceClient;

  constructor(
    @Inject(GrpcClientKind.BUSINESS)
    private readonly businessClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcBusiness = this.businessClient.getService(BUSINESS_SERVICE_NAME);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAdminGuard)
  async adminCreateClient(@Args() args: AdminCreateClientArgs) {
    await lastValueFrom(this.grpcBusiness.createClient(args));
    return true;
  }

  @UseGuards(GqlUserGuard)
  @Query(() => Boolean)
  @CacheControl(0)
  async checkSecretCode(
    @Args() args: CheckSecretCodeArgs,
    @CurrentUser() user: User,
  ) {
    await lastValueFrom(
      this.grpcBusiness.checkSecretCode({
        ...args,
        claimerAddress: user.address,
      }),
    );

    return true;
  }

  @Recaptcha({ action: 'claim' })
  @UseGuards(GqlUserGuard)
  @Mutation(() => Boolean)
  async consumeSecretCode(
    @Args() { metadata, ...args }: ConsumeSecretCodeArgs,
    @CurrentUser() user: User,
  ) {
    await lastValueFrom(
      this.grpcBusiness.consumeSecretCode({
        ...args,
        claimerAddress: user.address,
        metadata: encodeSerializedJson(metadata),
      }),
    );

    return true;
  }
}
