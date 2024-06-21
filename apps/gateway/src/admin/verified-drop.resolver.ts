import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  VerifiedDropServiceClient,
  VERIFIED_DROP_SERVICE_NAME,
} from '@generated/ts-proto/services/admin';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import {
  DeleteVerifiedDropArgs,
  UpsertVerifiedDropArgs,
} from './verified-drop.args';
import { VerifiedDrop } from './verified-drop.response';

@Resolver()
export class VerifiedDropResolver implements OnModuleInit {
  private readonly logger = new Logger(VerifiedDropResolver.name);

  private grpcVerifiedDrop: VerifiedDropServiceClient;

  constructor(
    @Inject(GrpcClientKind.ADMIN)
    private readonly adminClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcVerifiedDrop = this.adminClient.getService(
      VERIFIED_DROP_SERVICE_NAME,
    );
  }

  @Query(() => [VerifiedDrop])
  @CacheControl(0)
  async getVerifiedDrops() {
    const { drops } = await lastValueFrom(this.grpcVerifiedDrop.getAll(null));

    return drops || [];
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => VerifiedDrop)
  async upsertVerifiedDrop(@Args() args: UpsertVerifiedDropArgs) {
    return lastValueFrom(this.grpcVerifiedDrop.upsert(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async deleteVerifiedDrop(@Args() args: DeleteVerifiedDropArgs) {
    const { value: deleted } = await lastValueFrom(
      this.grpcVerifiedDrop.delete(args),
    );

    return deleted;
  }
}
