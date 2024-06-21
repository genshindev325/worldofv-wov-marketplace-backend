import ApolloServerPluginResponseCache from '@apollo/server-plugin-response-cache';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { ArweaveModule } from '@app/arweave';
import { DataloaderModule, DataloaderService } from '@app/dataloader';
import { FileUploadModule } from '@app/file-upload';
import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { LoginModule } from '@app/login';
import {
  RedisCacheModule,
  RedisClientModule,
  RedisOptionsModule,
  RedisOptionsService,
  REDIS_LRU_CLIENT,
} from '@app/redis-client';
import { TracingModule } from '@app/tracing';
import KeyvRedis from '@keyv/redis';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { UsersResolver } from 'apps/gateway/src/user/user.resolver';
import { MetricsController } from 'common/metrics.controller';
import Redis from 'ioredis';
import Keyv from 'keyv';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ActivityResolver } from './activity/activity.resolver';
import { HomeBannerResolver } from './admin/home-banner.resolver';
import { HomeCollectionResolver } from './admin/home-collection.resolver';
import { TopUserResolver } from './admin/top-user.resolver';
import { VerifiedDropResolver } from './admin/verified-drop.resolver';
import { AplosStatsResolver } from './aplos-stats/aplos-stats.resolver';
import { ArweaveResolver } from './arweave/arweave.resolver';
import { AuctionsResolver } from './auctions/auction.resolver';
import { AuthResolver } from './auth/auth.resolver';
import { BlockchainResolver } from './blockchain/blockchain.resolver';
import { BrandResolver } from './brand/brand.resolver';
import { BusinessResolver } from './business/business.resolver';
import { CollectionsResolver } from './collections/collection.resolver';
import { GqlThrottlerGuard } from './gql-throttler.guard';
import { ImportResolver } from './import/import.resolver';
import { MinimumOffersResolver } from './minimum-offers/minimum-offers.resolver';
import { OffersResolver } from './offers/offers.resolver';
import { PriceConversionResolver } from './price-conversion/price-conversion.resolver';
import { SearchResolver } from './search/search.resolver';
import { SocialVerificationController } from './social-verfication/social-verification.controller';
import { SocialVerificationResolver } from './social-verfication/social-verification.resolver';
import { TokensResolver } from './tokens/token.resolver';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ArweaveModule,
    RedisClientModule,
    GrpcOptionsModule,
    RedisCacheModule,
    LoginModule,
    GrpcClientModule.register(
      GrpcClientKind.ACTIVITY,
      GrpcClientKind.ADMIN,
      GrpcClientKind.APLOS_STATS,
      GrpcClientKind.AUCTION,
      GrpcClientKind.AUTH,
      GrpcClientKind.BLOCKCHAIN_STATS,
      GrpcClientKind.BUSINESS,
      GrpcClientKind.IMAGE_THUMBNAIL,
      GrpcClientKind.MARKETPLACE,
      GrpcClientKind.NFT_IMPORT,
      GrpcClientKind.NFT,
      GrpcClientKind.OFFER,
      GrpcClientKind.PRICE_CONVERSION,
      GrpcClientKind.SALE,
      GrpcClientKind.USER,
    ),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [RedisClientModule, DataloaderModule],
      inject: [REDIS_LRU_CLIENT, DataloaderService],
      useFactory: (redis: Redis, dataloaderService: DataloaderService) => {
        const store = new KeyvRedis(redis);
        const keyv = new Keyv({ store });

        return {
          playground: process.env.NODE_ENV !== 'production',
          introspection: true,
          autoSchemaFile: true,
          csrfPrevention: false,
          allowBatchedHttpRequests: true,
          context: ({ req, res }: any) => ({
            req,
            res,
            userAssetsLoader: dataloaderService.getUserAssetsLoader(),
          }),
          installSubscriptionHandlers: true,
          subscriptions: {
            'graphql-ws': true,
            'subscriptions-transport-ws': true,
          },
          plugins: [
            ApolloServerPluginCacheControl({
              // We set a high default max age so we don't have to specify the
              // directive on every non-scalar type. This is also going to set
              // the maximum possible duration for the cache globally so it should
              // be a fairly high value.
              // See: https://github.com/apollographql/apollo-server/issues/3559
              defaultMaxAge: 3600,
            }),
            ApolloServerPluginResponseCache({
              cache: new KeyvAdapter(keyv),
            }),
          ],
        } satisfies ApolloDriverConfig;
      },
    }),
    GoogleRecaptchaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secretKey: configService.get('GOOGLE_RECAPTCHA_SECRET_KEY'),
        actions: ['claim', 'pin_metadata', 'pin_image'],
        score: 0.7,
        response: (req) => {
          return req.headers['g-recaptcha-response']?.toString();
        },
        skipIf: (req: any) => {
          const isAdmin = req.user?.isAdmin;
          const isDevelopment = configService.get('NODE_ENV') !== 'production';
          return isAdmin || isDevelopment;
        },
      }),
    }),
    // TODO: whitelist frontend URL for SSR before enabling again.
    ThrottlerModule.forRootAsync({
      imports: [RedisOptionsModule],
      inject: [RedisOptionsService],
      useFactory: async (redisOptionsService: RedisOptionsService) => ({
        limit: 90,
        ttl: 30,
        skipIf: (context) => true,
        storage: new ThrottlerStorageRedisService(
          redisOptionsService.getRedisLruOptions(),
        ),
      }),
    }),
    TerminusModule,
    FileUploadModule,
    TracingModule.register('gateway'),
  ],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    ActivityResolver,
    AplosStatsResolver,
    ArweaveResolver,
    AuctionsResolver,
    AuthResolver,
    BlockchainResolver,
    BrandResolver,
    BusinessResolver,
    CollectionsResolver,
    HomeBannerResolver,
    HomeCollectionResolver,
    ImportResolver,
    MinimumOffersResolver,
    OffersResolver,
    PriceConversionResolver,
    SearchResolver,
    SocialVerificationResolver,
    TokensResolver,
    TopUserResolver,
    UsersResolver,
    VerifiedDropResolver,
  ],
  controllers: [MetricsController, SocialVerificationController],
})
export class GatewayModule {}
