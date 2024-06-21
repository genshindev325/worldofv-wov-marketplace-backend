import { WEB3_CLIENT } from '@app/web3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ThorifyContract, ThorifyWeb3 } from 'thorify';
import Web3 from 'web3';

import pfpBurnMint from '../../../abis/pfp-burn-mint.json';
import pfpStandard from '../../../abis/pfp-standard.json';
import staking from '../../../abis/staking.json';
import wovAuction from '../../../abis/wov-auction.json';
import wovNft from '../../../abis/wov-nft.json';
import wovOffer from '../../../abis/wov-offer.json';
import wovSaleV2 from '../../../abis/wov-sale-v2.json';
import wovSaleV3 from '../../../abis/wov-sale-v3.json';
import wovUser from '../../../abis/wov-user.json';
import wrappedVET from '../../../abis/wrapped-vet.json';

const ABI_MAPPING = {
  ['pfp-burn-mint']: pfpBurnMint,
  ['pfp-standard']: pfpStandard,
  ['staking']: staking,
  ['wov-auction']: wovAuction,
  ['wov-nft']: wovNft,
  ['wov-offer']: wovOffer,
  ['wov-sale-v2']: wovSaleV2,
  ['wov-sale-v3']: wovSaleV3,
  ['wov-user']: wovUser,
  ['wrapped-vet']: wrappedVET,
};

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private readonly contracts = new Map<string, ThorifyContract>();

  constructor(@Inject(WEB3_CLIENT) protected readonly web3: ThorifyWeb3) {}

  getContract(
    smartContractAddress: string,
    abiKind: keyof typeof ABI_MAPPING,
  ): ThorifyContract {
    smartContractAddress = Web3.utils.toChecksumAddress(smartContractAddress);

    let contract = this.contracts.get(smartContractAddress);

    if (!contract) {
      const abi = ABI_MAPPING[abiKind];
      contract = new this.web3.eth.Contract(abi, smartContractAddress);
      this.contracts.set(smartContractAddress, contract);
    }

    return contract;
  }
}
