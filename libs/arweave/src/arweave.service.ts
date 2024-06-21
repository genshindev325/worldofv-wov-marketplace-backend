import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Arweave from 'arweave';
import { CreateTransactionInterface } from 'arweave/node/common';
import { JWKInterface } from 'arweave/node/lib/wallet';

@Injectable()
export class ArweaveService {
  private readonly jwk: JWKInterface;

  constructor(private readonly arweave: Arweave, configService: ConfigService) {
    const key = configService.getOrThrow('ARWEAVE_WALLET_KEY');
    this.jwk = JSON.parse(key);
  }

  async upload(
    attributes: Partial<CreateTransactionInterface>,
    tags?: Record<string, string>,
  ) {
    const tx = await this.arweave.createTransaction(attributes, this.jwk);

    for (const [name, value] of Object.entries(tags)) {
      tx.addTag(name, value);
    }

    await this.arweave.transactions.sign(tx, this.jwk);

    const uploader = await this.arweave.transactions.getUploader(tx);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
    }

    return tx;
  }
}
