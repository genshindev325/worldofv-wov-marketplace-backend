import { GrpcClientModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { CacheModule, Module } from '@nestjs/common';
import { PriceConversionCacheService } from './price-conversion-cache.service';

@Module({
  imports: [
    GrpcClientModule.register(GrpcClientKind.PRICE_CONVERSION),
    CacheModule.register(),
  ],
  providers: [PriceConversionCacheService],
  exports: [PriceConversionCacheService],
})
export class PriceConversionCacheModule {}
