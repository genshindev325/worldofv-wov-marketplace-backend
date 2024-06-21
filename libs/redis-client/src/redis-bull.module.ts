import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueOptions } from 'bullmq';
import { RedisClientModule } from './redis-client.module';
import { RedisOptionsService } from './redis-options.service';

@Module({})
export class RedisBullModule {
  static register({ defaultJobOptions = {}, ...options }: QueueOptions = {}) {
    return BullModule.forRootAsync({
      imports: [RedisClientModule, ConfigModule.forRoot()],
      inject: [RedisOptionsService, ConfigService],
      useFactory: (
        redisOptionsService: RedisOptionsService,
        configService: ConfigService,
      ) => {
        return {
          connection: redisOptionsService.getRedisNoEvictOptions(),
          ...options,

          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 1000,
            attempts: Number(configService.get('QUEUE_MAX_ATTEMPTS', 3)),
            backoff: { type: 'exponential', delay: 5000 },
            ...defaultJobOptions,
          },
        };
      },
    });
  }
}
