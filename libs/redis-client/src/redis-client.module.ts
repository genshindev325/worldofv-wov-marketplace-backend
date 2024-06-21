import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientProxyFactory } from '@nestjs/microservices';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { RedisOptionsService } from './redis-options.service';

export const REDIS_LRU_CLIENT = 'REDIS_LRU_CLIENT';
export const REDIS_NOEVICT_CLIENT = 'REDIS_NOEVICT_CLIENT';
export const REDIS_CLIENT_PROXY = 'REDIS_CLIENT_PROXY';
export const REDIS_PUB_SUB = 'REDIS_PUB_SUB';

@Module({
  imports: [ConfigModule.forRoot()],
  exports: [
    RedisOptionsService,
    REDIS_LRU_CLIENT,
    REDIS_NOEVICT_CLIENT,
    REDIS_CLIENT_PROXY,
    REDIS_PUB_SUB,
  ],
  providers: [
    RedisOptionsService,
    {
      inject: [RedisOptionsService],
      provide: REDIS_LRU_CLIENT,
      useFactory: (redisOptionsService: RedisOptionsService) => {
        return new Redis(redisOptionsService.getRedisLruOptions());
      },
    },
    {
      inject: [RedisOptionsService],
      provide: REDIS_NOEVICT_CLIENT,
      useFactory: (redisOptionsService: RedisOptionsService) => {
        return new Redis(redisOptionsService.getRedisNoEvictOptions());
      },
    },
    {
      inject: [RedisOptionsService],
      provide: REDIS_CLIENT_PROXY,
      useFactory: (redisOptionsService: RedisOptionsService) => {
        return ClientProxyFactory.create(
          redisOptionsService.getRedisNestOptions(),
        );
      },
    },
    {
      inject: [RedisOptionsService],
      provide: REDIS_PUB_SUB,
      useFactory: (redisOptionsService: RedisOptionsService) => {
        return new RedisPubSub({
          connection: redisOptionsService.getRedisNoEvictOptions(),
        });
      },
    },
  ],
})
export class RedisClientModule {}
