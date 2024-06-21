import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const graphqlContext = GqlExecutionContext.create(context);
    return graphqlContext.getContext();
  }

  async handleRequest(context: ExecutionContext, limit: number, ttl: number) {
    if ((context.getType() as string) !== 'graphql') {
      return true;
    }

    const graphqlContext = GqlExecutionContext.create(context);

    // Throttling doesn't play well with GraphQL subscriptions so we skip it.
    // See https://github.com/nestjs/throttler/issues/1110
    if (graphqlContext.getInfo()?.parentType?.name === 'Subscription') {
      return true;
    }

    return super.handleRequest(context, limit, ttl);
  }
}
