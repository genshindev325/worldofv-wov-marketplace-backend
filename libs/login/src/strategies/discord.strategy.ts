import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy,
  StrategyOptions as DiscordStrategyOptions,
} from 'passport-discord';
import { StrategyOptions as OAuth2StrategyOptions } from 'passport-oauth2';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const baseUrl = configService.getOrThrow('BASE_URL').replace(/\/?$/, '');
    const clientID = configService.getOrThrow('DISCORD_OAUTH2_CLIENT_ID');
    const clientSecret = configService.getOrThrow('DISCORD_OAUTH2_SECRET');

    super({
      clientID,
      clientSecret,
      callbackURL: `${baseUrl}/auth/discord`,
      scope: ['identify'],
      state: true,
      pkce: true,
    } satisfies DiscordStrategyOptions & Partial<OAuth2StrategyOptions>);
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: Profile,
  ) {
    return profile;
  }
}
