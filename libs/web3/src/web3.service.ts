import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ThorifyWeb3 } from 'thorify';
import { WEB3_CLIENT } from './web3.module';

@Injectable()
export class Web3Service {
  constructor(
    @Inject(forwardRef(() => WEB3_CLIENT)) protected readonly web3: ThorifyWeb3,
  ) {}

  public async getBlockNumberFromTimestamp(timestamp: number) {
    const logs = await this.web3.eth.getPastLogs({
      range: { unit: 'time', from: timestamp },
      options: { limit: 1 },
    });

    let blockNumber = logs?.[0]?.blockNumber;

    if (!blockNumber) {
      blockNumber = await this.web3.eth.getBlockNumber();
    }

    return blockNumber;
  }
}
