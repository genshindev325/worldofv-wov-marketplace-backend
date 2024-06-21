import { Web3Module } from '@app/web3';
import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';

@Module({
  imports: [Web3Module],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
