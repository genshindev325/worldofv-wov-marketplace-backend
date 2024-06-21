import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlAuthGuard } from './gql-auth.guard';

@Injectable()
export class GqlUserGuard extends GqlAuthGuard {
  async handleRequest(err: any, user: any) {
    if (err) throw err;

    if (!user) {
      throw new UnauthorizedException(
        'Access is denied due to invalid credentials.',
      );
    }

    return user;
  }
}
