import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NftImportModule } from '../nft-import.module';
import { SmartContractConsumer } from './smart-contract.consumer';
import { TokenFetcherService } from './token-fetcher.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    forwardRef(() => NftImportModule),
    BullModule.registerQueue({ name: 'nft-import/smart-contract' }),
  ],
  providers: [TokenFetcherService, SmartContractConsumer],
  exports: [BullModule, SmartContractConsumer],
})
export class SmartContractModule {}
