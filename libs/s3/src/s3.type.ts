export type S3GetObject = {
  bucketName?: string;
  key: string;
};

export type S3PutObject = {
  bucketName?: string;
  mimeType?: string;
  path?: string;
  fileName?: string;
  file: Buffer;
};

export type S3DeleteObject = {
  bucketName?: string;
  key?: string;
  path?: string;
};
