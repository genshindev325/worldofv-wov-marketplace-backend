import fs from 'fs';
import stream from 'stream';

export type Source =
  | string
  | fs.ReadStream
  | stream.PassThrough
  | Buffer
  | { uri: string };
