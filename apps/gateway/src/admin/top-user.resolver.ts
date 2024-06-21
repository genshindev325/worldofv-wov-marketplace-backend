import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  TopUserServiceClient,
  TOP_USER_SERVICE_NAME,
} from '@generated/ts-proto/services/admin';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import {
  DeleteTopUserArgs,
  GetAllTopUsersArgs,
  UpsertTopUserArgs,
} from './top-user.args';
import { TopUser } from './top-user.response';

@Resolver()
export class TopUserResolver implements OnModuleInit {
  private readonly logger = new Logger(TopUserResolver.name);

  private grpcTopUser: TopUserServiceClient;

  constructor(
    @Inject(GrpcClientKind.ADMIN)
    private readonly adminClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcTopUser = this.adminClient.getService(TOP_USER_SERVICE_NAME);
  }

  @Query(() => [TopUser])
  @CacheControl(0)
  async getTopUsers(@Args() args: GetAllTopUsersArgs) {
    const { users } = await lastValueFrom(this.grpcTopUser.getAll(args));

    return users || [];
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => TopUser)
  async upsertTopUser(@Args() args: UpsertTopUserArgs) {
    return lastValueFrom(this.grpcTopUser.upsert(args));
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async deleteTopUser(@Args() args: DeleteTopUserArgs) {
    const { value: deleted } = await lastValueFrom(
      this.grpcTopUser.delete(args),
    );

    return deleted;
  }
}
