import { forwardRef, Module } from '@nestjs/common';
import { NftModule } from '../nft.module';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';

@Module({
  imports: [forwardRef(() => NftModule)],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
