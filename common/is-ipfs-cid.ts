import { CID } from 'multiformats/cid';

export default function isIpfsCid(cid: string) {
  try {
    CID.parse(cid);
    return true;
  } catch {
    return false;
  }
}
