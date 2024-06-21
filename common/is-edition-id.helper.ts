import { isSameAddress } from './is-same-address.helper';

export default function isEditionId(smartContractAddress: string, id: string) {
  if (
    isSameAddress(
      smartContractAddress,
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
    )
  ) {
    return !id.endsWith('00000');
  } else {
    return true;
  }
}
