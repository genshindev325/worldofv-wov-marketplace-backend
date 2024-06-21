import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlUserGuard } from '@app/login';
import { CurrentUser } from '@app/login/current-user.decorator';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import {
  Inject,
  OnModuleInit,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ClientGrpc } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';
import CacheControl from '../cache-control.decorator';
import { User } from '../user/user.response';
import { SocialAccountProvider } from './social-verification.args';

@Resolver()
export class SocialVerificationResolver implements OnModuleInit {
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  /**
   * The resulting token will be passed to the backend as query parameter during
   * social account verification. We use this method to make sure the user has
   * authorized the update.
   */
  @Query(() => String)
  @CacheControl(0)
  @UseGuards(GqlUserGuard)
  async getSocialToken(@CurrentUser() user: User) {
    if (!user.profileId) {
      throw new UnauthorizedException('User is not registered.');
    }

    // Since the token is sent as query parameters we need to use a short
    // expiration and a unique identifier for the token to make it single use
    // and minimize the attack surface.
    return this.jwtService.signAsync(
      {},
      { subject: user.address, expiresIn: '5m', jwtid: randomUUID() },
    );
  }

  @Mutation(() => User)
  @CacheControl(0)
  @UseGuards(GqlUserGuard)
  async unlinkSocialAccount(
    @Args({ name: 'provider', type: () => SocialAccountProvider })
    provider: string,

    @CurrentUser()
    user: User,
  ) {
    return lastValueFrom(
      this.grpcUser.update({
        address: user.address,
        twitterUrl: provider === SocialAccountProvider.TWITTER ? '' : undefined,
        discordUrl: provider === SocialAccountProvider.DISCORD ? '' : undefined,
        instagramUrl:
          provider === SocialAccountProvider.INSTAGRAM ? '' : undefined,
      }),
    );
  }
}
