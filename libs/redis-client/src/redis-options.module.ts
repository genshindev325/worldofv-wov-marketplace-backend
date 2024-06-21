import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisOptionsService } from './redis-options.service';

@Module({
  imports: [ConfigModule.forRoot()],
  exports: [RedisOptionsService],
  providers: [RedisOptionsService],
})
export class RedisOptionsModule {}
