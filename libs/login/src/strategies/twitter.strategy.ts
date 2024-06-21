import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ProfileWithMetaData,
  Strategy,
  StrategyOptions,
} from '@superfaceai/passport-twitter-oauth2';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const baseUrl = configService.getOrThrow('BASE_URL').replace(/\/?$/, '');
    const clientID = configService.getOrThrow('TWITTER_OAUTH2_CLIENT_ID');
    const clientSecret = configService.getOrThrow('TWITTER_OAUTH2_SECRET');

    super({
      clientType: 'confidential',
      clientID,
      clientSecret,
      callbackURL: `${baseUrl}/auth/twitter`,
      scope: ['users.read', 'tweet.read'],
    } satisfies StrategyOptions);
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: ProfileWithMetaData,
  ) {
    return profile;
  }
}
