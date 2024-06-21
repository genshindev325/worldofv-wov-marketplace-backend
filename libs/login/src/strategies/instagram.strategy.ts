import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import {
  InternalOAuthError,
  Strategy as OAuth2Strategy,
  StrategyOptions as OAuth2StrategyOptions,
} from 'passport-oauth2';

export interface InstagramProfile extends Profile {
  id: string;
  username: string;
  _raw: string;
  _json: any;
}

/**
 * We have to create a custom strategy since `passport-instagram` uses the old
 * API to fetch the user information, resulting in an error.
 */
@Injectable()
export class InstagramStrategy extends PassportStrategy(
  OAuth2Strategy,
  'instagram',
) {
  constructor(configService: ConfigService) {
    const baseUrl = configService.getOrThrow('BASE_URL').replace(/\/?$/, '');
    const clientID = configService.getOrThrow('INSTAGRAM_OAUTH2_CLIENT_ID');
    const clientSecret = configService.getOrThrow('INSTAGRAM_OAUTH2_SECRET');

    super({
      authorizationURL: 'https://api.instagram.com/oauth/authorize/',
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientID,
      clientSecret,
      callbackURL: `${baseUrl}/auth/instagram`,
      state: true,
      pkce: true,
      scope: ['user_profile'],
    } satisfies OAuth2StrategyOptions);
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: InstagramProfile,
  ) {
    return profile;
  }

  /**
   * See https://github.com/jaredhanson/passport-instagram/issues/22
   */
  userProfile(accessToken: string, done: (...args: any) => void) {
    this._oauth2.get(
      'https://graph.instagram.com/me?fields=id,username',
      accessToken,
      (error, body: string) => {
        if (error) {
          return done(
            new InternalOAuthError('failed to fetch user profile', error),
          );
        }

        try {
          const json = JSON.parse(body);

          const profile: InstagramProfile = {
            provider: 'instagram',
            id: json.id,
            username: json.username,
            displayName: json.username,
            _raw: body,
            _json: json,
          };

          done(null, profile);
        } catch (error) {
          done(error);
        }
      },
    );
  }
}
