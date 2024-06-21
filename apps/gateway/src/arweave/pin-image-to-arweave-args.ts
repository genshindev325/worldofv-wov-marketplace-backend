import { ArgsType, Field } from '@nestjs/graphql';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@ArgsType()
export class PinImageToArweaveArgs {
  @Field(() => GraphQLUpload)
  image: Promise<FileUpload>;
}
