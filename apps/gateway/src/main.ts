import { REDIS_NOEVICT_CLIENT } from '@app/redis-client';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import RedisStore from 'connect-redis';
import session from 'express-session';
import { graphqlUploadExpress } from 'graphql-upload';
import helmet from 'helmet';
import { ExtendedRpcExceptionFilter } from './extended-rpc-exception.filter';
import { GatewayModule } from './gateway.module';
import { GoogleRecaptchaExceptionFilter } from './google-recaptcha-exception.filter';
import { HttpExceptionFilter } from './http-exception.filter';

const MAX_FILE_COUNT = 10;

// If a different value is needed you must also change the `proxy-body-size`
// NGINX ingress parameter to match.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

async function bootstrap() {
  const logger = new Logger(GatewayModule.name);
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule);

  app.set('trust proxy', 1);

  app.useLogger(logger);

  const configService = app.get(ConfigService);

  const isProduction = configService.get('NODE_ENV') === 'production';

  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  app.use(
    graphqlUploadExpress({
      maxFileSize: MAX_FILE_SIZE_BYTES,
      maxFiles: MAX_FILE_COUNT,
    }),
  );

  app.use(bodyParser.json({ limit: '1MB' }));

  // Since the gateway is scaled to multiple instances we need to use redis as
  // distributed session store.
  const redisClient = app.get(REDIS_NOEVICT_CLIENT);
  const store = new RedisStore({ client: redisClient, prefix: 'session:' });

  app.use(
    session({
      secret: configService.getOrThrow('SESSION_SECRET'),
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: isProduction, httpOnly: true, sameSite: 'lax' },
    }),
  );

  const allowedOrigins = [
    configService.getOrThrow('SITE_LINK'),
    /^https:\/\/.+--marketplace-worldofv-prod\.netlify\.app$/,
    /^https?:\/\/localhost:\d+$/,
    /^https:\/\/.+\.ngrok\.io$/,
    'https://wovnft.tools',
    'https://wov-tools.sedas.be',
    'https://mobility-tester.w3spaces.com',
    'https://bar-tester.w3spaces.com',
    'https://market-tester.w3spaces.com',
    'https://pawn-tester.w3spaces.com',
  ];

  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, forbidUnknownValues: false }),
  );

  app.useGlobalFilters(
    new ExtendedRpcExceptionFilter(),
    new GoogleRecaptchaExceptionFilter(),
    new HttpExceptionFilter(),
  );

  const port = configService.getOrThrow('GATEWAY_SERVICE_PORT');
  await app.listen(port, '0.0.0.0');

  const listeningOn = await app.getUrl();
  logger.log(`HTTP listening on ${listeningOn}`);
}

bootstrap();
