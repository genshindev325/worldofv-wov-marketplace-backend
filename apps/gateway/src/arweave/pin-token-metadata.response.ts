import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export default class PinTokenMetadataResponse {
  @Field()
  metadataTxId: string;

  @Field()
  imageTxId: string;
}
