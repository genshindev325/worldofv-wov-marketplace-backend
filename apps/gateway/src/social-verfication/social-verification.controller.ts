import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  DiscordVerificationGuard,
  InstagramVerificationGuard,
  TwitterVerificationGuard,
} from '@app/login/guards/social-verification.guard';
import { InstagramProfile } from '@app/login/strategies/instagram.strategy';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import {
  Controller,
  Get,
  Inject,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Profile as TwitterProfile } from '@superfaceai/passport-twitter-oauth2';
import { Request } from 'express';
import { Profile as DiscordProfile } from 'passport-discord';
import { lastValueFrom } from 'rxjs';

/**
 * Note: this controller is not used for the actual login of the user but only
 * for binding user profiles to their social account.
 */
@Controller('auth')
export class SocialVerificationController {
  private redirectUrl: string;
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER) userClient: ClientGrpc,
    configService: ConfigService,
  ) {
    const siteUrl = configService.getOrThrow('SITE_LINK').replace(/\/$/, '');
    this.redirectUrl = siteUrl + '/profile/edit';
    this.grpcUser = userClient.getService(USER_SERVICE_NAME);
  }

  @Get('twitter')
  @Redirect()
  @UseGuards(TwitterVerificationGuard)
  async twitter(@Req() req: Request) {
    const twitterUser = req.user as TwitterProfile;

    await lastValueFrom(
      this.grpcUser.update({
        address: req.authInfo!.state!.socialUser!,
        twitterUrl: `https://twitter.com/${twitterUser.username}`,
      }),
    );

    return { url: this.redirectUrl };
  }

  @Get('discord')
  @Redirect()
  @UseGuards(DiscordVerificationGuard)
  async discord(@Req() req: Request) {
    const discordUser = req.user as DiscordProfile;

    await lastValueFrom(
      this.grpcUser.update({
        address: req.authInfo!.state!.socialUser!,
        discordUrl: `https://discord.com/users/${discordUser.username}`,
      }),
    );

    return { url: this.redirectUrl };
  }

  @Get('instagram')
  @Redirect()
  @UseGuards(InstagramVerificationGuard)
  async instagram(@Req() req: Request) {
    const instagramUser = req.user as InstagramProfile;

    await lastValueFrom(
      this.grpcUser.update({
        address: req.authInfo!.state!.socialUser!,
        instagramUrl: `https://instagram.com/${instagramUser.username}`,
      }),
    );

    return { url: this.redirectUrl };
  }
}
