import { Directive } from '@nestjs/graphql';
import { CacheScope } from 'apollo-server-types';

/**
 * See https://www.apollographql.com/docs/apollo-server/performance/caching#in-your-schema-static
 */
export default function CacheControl(
  ttl: number | 'inherit',
  scope: CacheScope = CacheScope.Public,
) {
  const maxAge = ttl === 'inherit' ? null : ttl;
  const inheritMaxAge = ttl === 'inherit';

  return Directive(
    `@cacheControl(maxAge: ${maxAge}, inheritMaxAge: ${inheritMaxAge}, scope: ${scope})`,
  );
}
