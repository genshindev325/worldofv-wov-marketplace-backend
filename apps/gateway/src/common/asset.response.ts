import { AssetSize } from '@generated/ts-proto/types/asset';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(AssetSize, { name: 'AssetSize' });

@ObjectType()
export class AssetDTO {
  @Field()
  url: string;

  @Field()
  mimeType: string;

  @Field(() => AssetSize)
  size: AssetSize;
}
