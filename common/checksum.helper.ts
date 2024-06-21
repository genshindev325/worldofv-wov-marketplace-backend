import crypto from 'crypto';

interface GenerateChecksumArgs {
  algorithm?: string;
  encoding?: crypto.BinaryToTextEncoding;
  options?: crypto.HashOptions;
}

export const generateChecksum = (
  data: crypto.BinaryLike,
  args?: GenerateChecksumArgs,
): string => {
  const { algorithm = 'md5', encoding = 'hex', options } = args || {};
  return crypto.createHash(algorithm, options).update(data).digest(encoding);
};
