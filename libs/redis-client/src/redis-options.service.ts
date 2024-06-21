import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RedisOptions as NestRedisOptions,
  Transport,
} from '@nestjs/microservices';
import parseBool from 'common/parse-bool.helper';
import { RedisOptions } from 'ioredis';

// TODO?: Use environment variables to set these values instead of hardcoding them.
const MAX_RETRY_ATTEMPTS = 10;
const RETRY_BASE_DELAY = 1000;
const CONNECT_TIMEOUT = 60000;

const COMMON_OPTIONS: RedisOptions = {
  connectTimeout: CONNECT_TIMEOUT,

  reconnectOnError() {
    return true;
  },

  retryStrategy(times) {
    return times < MAX_RETRY_ATTEMPTS ? times * RETRY_BASE_DELAY : null;
  },
};

@Injectable()
export class RedisOptionsService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieve the connection options for the redis server.
   * The target production server will be configured using the `noeviction`
   * eviction policy. This does not apply during development since a single
   * redis instance is used for all connections.
   */
  getRedisNoEvictOptions(): RedisOptions {
    return {
      ...COMMON_OPTIONS,
      host: this.configService.getOrThrow<string>('QUEUE_REDIS_HOST'),
      port: +this.configService.getOrThrow<string>('QUEUE_REDIS_PORT'),
      username: this.configService.getOrThrow<string>('QUEUE_REDIS_USERNAME'),
      password: this.configService.getOrThrow<string>('QUEUE_REDIS_PASSWORD'),
      tls: parseBool(this.configService.get('QUEUE_REDIS_TLS'))
        ? {}
        : undefined,
    };
  }

  /**
   * Retrieve the connection options for the redis server.
   * The target production server will be configured using the `allkeys-lru`
   * eviction policy. This does not apply during development since a single
   * redis instance is used for all connections.
   */
  getRedisLruOptions(): RedisOptions {
    return {
      ...COMMON_OPTIONS,
      host: this.configService.getOrThrow<string>('CACHE_REDIS_HOST'),
      port: +this.configService.getOrThrow<string>('CACHE_REDIS_PORT'),
      username: this.configService.getOrThrow<string>('CACHE_REDIS_USERNAME'),
      password: this.configService.getOrThrow<string>('CACHE_REDIS_PASSWORD'),
      tls: parseBool(this.configService.get('CACHE_REDIS_TLS'))
        ? {}
        : undefined,
    };
  }

  getRedisNestOptions(): NestRedisOptions {
    return {
      transport: Transport.REDIS,
      options: {
        ...this.getRedisNoEvictOptions(),
        retryAttempts: MAX_RETRY_ATTEMPTS,
        retryDelay: RETRY_BASE_DELAY * (MAX_RETRY_ATTEMPTS / 2),
      },
    };
  }
}
