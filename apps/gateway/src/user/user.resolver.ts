import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard, GqlAuthGuard, GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Asset, AssetSource } from '@generated/ts-proto/types/asset';
import {
  User as RpcUser,
  VerifiedStatus,
} from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { User } from 'apps/gateway/src/user/user.response';
import { isSameAddress } from 'common/is-same-address.helper';
import streamToBuffer from 'common/stream-to-buffer.helper';
import DataLoader from 'dataloader';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { FindOneUserArgs } from './find-one-user.args';
import { UpdateUserArgs } from './update-user.args';

/**
 * When we are logging in we don't want to hide fields from the user data even
 * though no bearer token is included with the request.
 */
function isLoginOperation(info: any) {
  let path = info?.path;
  while (typeof path?.prev === 'object') path = path.prev;
  return path?.key === 'login' && path?.typename === 'Mutation';
}

@Resolver(() => User)
export class UsersResolver implements OnModuleInit {
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => User, { nullable: true })
  @CacheControl(0)
  async getUser(@Args() args: FindOneUserArgs) {
    return lastValueFrom(
      this.grpcUser.findOne(args).pipe(
        catchError((err) => {
          if (err?.code === GrpcStatus.NOT_FOUND) {
            return of(null);
          } else {
            return throwError(() => err);
          }
        }),
      ),
    );
  }

  @UseGuards(GqlUserGuard)
  @Mutation(() => User)
  async updateUser(
    @Args() { profileImage, bannerImage, ...args }: UpdateUserArgs,
    @CurrentUser() user: RpcUser,
  ) {
    let profileImageSource: AssetSource | undefined;
    let bannerImageSource: AssetSource | undefined;

    if (profileImage) {
      const upload = await profileImage;
      const buffer = await streamToBuffer(upload.createReadStream());
      profileImageSource = { buffer };
    }

    if (bannerImage) {
      const upload = await bannerImage;
      const buffer = await streamToBuffer(upload.createReadStream());
      bannerImageSource = { buffer };
    }

    const userData = {
      address: user.address,
      profileImageSource,
      bannerImageSource,
      ...args,
    };

    return this.grpcUser.update(userData);
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => User)
  async adminUpdateUser(
    @Args('userAddress')
    address: string,

    @Args('isAdmin', { nullable: true })
    isAdmin?: boolean | null,

    @Args('blacklisted', { nullable: true })
    blacklisted?: boolean | null,

    @Args('verified', { nullable: true })
    verified?: boolean | null,

    @Args('verifiedLevel', { type: () => VerifiedStatus, nullable: true })
    verifiedLevel?: VerifiedStatus | null,
  ) {
    return this.grpcUser.update({
      address,
      blacklisted,
      isAdmin,
      verified,
      verifiedLevel: verifiedLevel as any,
    });
  }

  @ResolveField()
  async assets(
    @Parent() user: User,
    @Context('userAssetsLoader') userAssetsLoader: DataLoader<string, Asset[]>,
  ) {
    return userAssetsLoader.load(user.address);
  }

  @ResolveField()
  async firstName(
    @Parent() parent: User,
    @CurrentUser() user: RpcUser,
    @Info() info: any,
  ) {
    if (
      isSameAddress(parent.address, user?.address) ||
      isLoginOperation(info)
    ) {
      return parent.firstName;
    } else {
      return null;
    }
  }

  @ResolveField()
  async lastName(
    @Parent() parent: User,
    @CurrentUser() user: User,
    @Info() info: any,
  ) {
    if (
      isSameAddress(parent.address, user?.address) ||
      isLoginOperation(info)
    ) {
      return parent.lastName;
    } else {
      return null;
    }
  }
}
