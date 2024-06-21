import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

/**
 * This guard doesn't do anything apart from injecting the current user in
 * the request context as `req.user`. If you require a logged user to be present
 *  you can use `GqlUserGuard` or `GqlAdminGuard`.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  handleRequest(error: any, user: any) {
    return user;
  }
}
