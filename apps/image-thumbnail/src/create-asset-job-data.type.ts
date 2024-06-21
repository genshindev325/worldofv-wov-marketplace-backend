import { AssetSize } from '@generated/ts-proto/types/asset';
import { AssetEntityKind } from '@prisma/client/image-thumbnail';

export class AssetEntityToken {
  kind: typeof AssetEntityKind.TOKEN;
  smartContractAddress: string;
  tokenId: string;
}

// export class AssetEntityCollection {
//   kind: AssetEntityKind.COLLECTION_BANNER | AssetEntityKind.COLLECTION_AVATAR;
//   smartContractAddress: string;
// }

export class AssetEntityUser {
  kind: typeof AssetEntityKind.USER_BANNER | typeof AssetEntityKind.USER_AVATAR;
  address: string;
}

export type AssetEntity =
  | AssetEntityToken
  // | AssetEntityCollection
  | AssetEntityUser;

export interface CreateAssetJobData {
  url: string;
  size: AssetSize;
  entity: AssetEntity;
  mimeType: string;
  extension: string;
}
