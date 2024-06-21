import { isSameAddress } from './is-same-address.helper';

export default function getTokenIdFromEditionId(
  smartContractAddress: string,
  editionId: string,
) {
  if (
    isSameAddress(
      smartContractAddress,
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
    )
  )
    return editionId.replace(/.{5}$/, '00000');
  else {
    return editionId;
  }
}
