import {
  CACHE_MANAGER,
  ExecutionContext,
  Inject,
  Injectable,
  Type,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { lastValueFrom } from 'rxjs';

function createVerificationGuard(strategy: string): Type<IAuthGuard> {
  @Injectable()
  class VerificationGuard extends AuthGuard(strategy) {
    /**
     * The TTL should match the expiration of the token so we don't keep
     * accumulating data.
     */
    private static readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutes
    private static readonly CACHE_PREFIX = 'VERIFICATION_TOKEN';

    constructor(
      private readonly jwtService: JwtService,
      @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {
      super();
    }

    async canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest() as Request;

      // If the social token is not present it means we are in the callback and
      // the token has already been validated.
      if (req.query['social_token']) {
        // Here we validate the social token that has been passed as query param
        // from the frontend. Theoretically using query parameters is not very
        // safe since data transmitted in the query string is not completely
        // private, but the token is very short lived and it can be used
        // exclusively to update the twitter URL.
        try {
          const encoded = req.query['social_token'].toString();
          const decoded = await this.jwtService.verifyAsync(encoded);
          const key = VerificationGuard.CACHE_PREFIX + ':' + decoded.jti;
          const entry = await this.cacheManager.get(key);

          // Make sure the token can be used only once.
          if (entry) {
            return false;
          } else {
            await this.cacheManager.set(key, true, VerificationGuard.CACHE_TTL);
          }
        } catch (error) {
          return false;
        }
      }

      let res = await super.canActivate(context);
      if (typeof res !== 'boolean') res = await lastValueFrom(res);
      return res;
    }

    getAuthenticateOptions(context: ExecutionContext): Express.AuthInfo {
      const req = context.switchToHttp().getRequest() as Request;

      // If no query is present and `canActivate` didn't fail we are in the
      // callback.
      if (!req.query['social_token']) return {};

      // Here we store the user address contained in the social token from the
      // frontend in the session state so it will be available in the callback.
      const encoded = req.query['social_token'].toString();
      // We already verified the token in `canActivate` so here we can just
      // decode it.
      const decoded = this.jwtService.decode(encoded) as Record<string, any>;

      // Please note that to be able to preserve state on the callback we
      // exploit the session created in the PKCE flow to store our information,
      // so every strategy should employ it for this to work. See
      // https://medium.com/passportjs/application-state-in-oauth-2-0-1d94379164e
      return { state: { socialUser: decoded.sub } };
    }
  }

  return VerificationGuard;
}

export const TwitterVerificationGuard = createVerificationGuard('twitter');
export const DiscordVerificationGuard = createVerificationGuard('discord');
export const InstagramVerificationGuard = createVerificationGuard('instagram');
