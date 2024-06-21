import { BlockchainSyncService } from '@app/blockchain-sync';
import { ContractService } from '@blockchain/contract';
import { Injectable, OnModuleInit } from '@nestjs/common';
import isBurnAddress from 'common/is-burn-address';
import { ThorifyContract } from 'thorify';
import { TokenService } from './token.service';

@Injectable()
export class EditionService implements OnModuleInit {
  public contract: ThorifyContract;

  constructor(
    private readonly tokenService: TokenService,
    private readonly contractService: ContractService,
    private readonly blockchainSyncService: BlockchainSyncService,
  ) {}

  async onModuleInit() {
    this.contract = this.contractService.getContract(
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
      'wov-nft',
    );
  }

  //? IMPROVEMENT: Use Transfer events instead of editionsCount
  async getEditions(tokenId: string) {
    const editionsCount = await this.contract.methods
      .woviesEditionNumber(tokenId)
      .call();

    const editionIds = Array.from({ length: editionsCount }, (_, i) =>
      tokenId.replace(/.{5}$/, (i + 1).toString().padStart(5, '0')),
    );

    return await Promise.all(
      editionIds.map(async (editionId) => {
        const ownerAddress = await this.blockchainSyncService.getOwner(
          this.contract,
          editionId,
        );

        const lastTransferAt =
          await this.blockchainSyncService.getLastTransferBlockNumber(
            process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
            editionId,
            ownerAddress,
          );

        return {
          smartContractAddress: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
          tokenId,
          editionId,
          ownerAddress: ownerAddress || null,
          updatedAt: lastTransferAt,
        };
      }),
    ).then((editions) =>
      editions.filter(
        (edition) =>
          edition.ownerAddress && !isBurnAddress(edition.ownerAddress),
      ),
    );
  }
}
