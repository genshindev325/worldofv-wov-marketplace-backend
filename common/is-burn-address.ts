import Web3 from 'web3';
import { BURN_ADDRESSES_TO_CHECK } from './constants';

export default function isBurnAddress(ownerAddress: string): boolean {
  return BURN_ADDRESSES_TO_CHECK.includes(
    Web3.utils.toChecksumAddress(ownerAddress),
  );
}
