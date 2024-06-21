import { ContractModule } from '@blockchain/contract';
import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NftImportModule } from '../nft-import.module';
import { StakingContractConsumer } from './staking-contract.consumer';

@Module({
  imports: [
    ConfigModule.forRoot(),
    forwardRef(() => NftImportModule),
    BullModule.registerQueue({ name: 'nft-import/staking-contract' }),
    ContractModule,
  ],
  providers: [StakingContractConsumer],
  exports: [BullModule, StakingContractConsumer],
})
export class StakingContractModule {}
