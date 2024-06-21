import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import _, { uniqueId } from 'lodash';
import objectHash from 'object-hash';
import { Observable, of, retry, timer } from 'rxjs';

@Injectable()
export class MarketplaceSyncInterceptor<T>
  implements NestInterceptor<T, Promise<T>>
{
  private readonly logger = new Logger(MarketplaceSyncInterceptor.name);

  private readonly MARKETPLACE_UPDATE_RETRY_COUNT = 10;
  private readonly MARKETPLACE_UPDATE_RETRY_BASE_DELAY = 1000;
  private readonly MARKETPLACE_DEDUPE_DELAY = 1000;

  // [operation hash] -> [request id]
  private readonly pendingRequests = new Map<string, string>();

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<Promise<T>>> {
    const args = ctx.switchToRpc().getData();
    const info = ctx.switchToRpc().getContext();
    const operationHash = objectHash({ args, info });
    const requestId = uniqueId();

    this.pendingRequests.set(operationHash, requestId);

    /**
     * Sometimes events come in batches very close in time so instead of
     * executing the request immediately we wait for a while to check if
     * another identical request comes through. Ideally we would start fetching
     * the data right away but AFAIK js promises are not cancelable.
     */
    await new Promise((resolve) =>
      setTimeout(resolve, this.MARKETPLACE_DEDUPE_DELAY),
    );

    if (this.pendingRequests.get(operationHash) !== requestId) {
      this.logger.log(`Skipping duplicated request for '${info?.args?.[0]}'`);
      return of(Promise.resolve(null));
    }

    return next.handle().pipe(
      retry({
        count: this.MARKETPLACE_UPDATE_RETRY_COUNT,
        delay: (error, retryCount) => {
          // These errors usually mean that some other process is trying to update
          // the same rows in the database.
          if (
            error?.meta?.code === '40P01' /* deadlock detected */ ||
            error?.message?.includes('code: SqlState(E40P01)') ||
            error?.code === 'P2002' /* unique constraint failed */ ||
            error?.message?.includes('Version mismatch')
          ) {
            // Randomize the delay so the processes don't retry at the same
            // exact time.
            const delay = _.random(
              0,
              retryCount * this.MARKETPLACE_UPDATE_RETRY_BASE_DELAY,
            );

            this.logger.warn(
              `Error while updating marketplace, retrying in ${delay}ms (${retryCount}/${this.MARKETPLACE_UPDATE_RETRY_COUNT}).`,
            );

            return timer(delay);
          } else {
            throw error;
          }
        },
      }),
    );
  }
}
