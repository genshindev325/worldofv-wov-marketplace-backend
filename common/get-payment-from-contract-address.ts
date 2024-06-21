import Web3 from 'web3';
import { ZERO_ADDRESS } from './constants';
import { isSameAddress } from './is-same-address.helper';

export const getPaymentFromContractAddress = (address?: string | null) => {
  if (!address || isSameAddress(address, ZERO_ADDRESS)) return 'VET';

  const checksumAddress = Web3.utils.toChecksumAddress(address);

  switch (checksumAddress) {
    case Web3.utils.toChecksumAddress(process.env.WOV_GOVERNANCE_TOKEN_ADDRESS):
      return 'WoV';
    case Web3.utils.toChecksumAddress(process.env.WRAPPED_VET_CONTRACT_ADDRESS):
      return 'vVET';
    default:
      throw new Error(`Unknown payment address: ${checksumAddress}`);
  }
};
