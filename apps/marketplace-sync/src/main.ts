import { RedisOptionsService } from '@app/redis-client';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MarketplaceSyncModule } from './marketplace-sync.module';

async function bootstrap() {
  const logger = new Logger(MarketplaceSyncModule.name);
  const app = await NestFactory.create(MarketplaceSyncModule);

  app.useLogger(logger);

  const redisOptionsService = app.get(RedisOptionsService);
  const redisOptions = redisOptionsService.getRedisNestOptions();
  app.connectMicroservice(redisOptions);

  await app.startAllMicroservices();
  logger.log(
    `Redis listening on ${redisOptions.options.host}:${redisOptions.options.port}`,
  );

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow('MARKETPLACE_SYNC_SERVICE_PORT');
  await app.listen(port, '0.0.0.0');

  const listeningOn = await app.getUrl();
  logger.log(`HTTP listening on ${listeningOn}`);
}

bootstrap();
