import { FileUpload } from 'graphql-upload';

export interface UploadFileOptionsArgs {
  path?: string;
  previousUrl?: string;
}

export interface UploadFileArgs extends UploadFileOptionsArgs {
  fileBuffer: Buffer;
}

export interface UploadFileGqlArgs extends UploadFileOptionsArgs {
  file: FileUpload | Promise<FileUpload>;
}

export interface UploadFileUrlArgs extends UploadFileOptionsArgs {
  url: string;
}
