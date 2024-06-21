import { CacheModule, Module } from '@nestjs/common';
import { redisInsStore } from 'cache-manager-ioredis-yet';
import { Redis } from 'ioredis';
import { RedisClientModule, REDIS_LRU_CLIENT } from './redis-client.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [RedisClientModule],
      inject: [REDIS_LRU_CLIENT],
      useFactory: (redis: Redis) => ({ store: redisInsStore(redis) }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
