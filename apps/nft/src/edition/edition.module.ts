import { forwardRef, Module } from '@nestjs/common';
import { NftModule } from '../nft.module';
import { EditionController } from './edition.controller';

@Module({
  imports: [forwardRef(() => NftModule)],
  controllers: [EditionController],
})
export class EditionModule {}
