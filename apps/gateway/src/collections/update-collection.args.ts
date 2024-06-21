import { ArgsType, Field } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@ArgsType()
export class UpdateCollectionArgs {
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  collectionId?: string | null;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  name?: string | null;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true, defaultValue: true })
  isVisible?: boolean | null;

  @IsOptional()
  @Field(() => GraphQLUpload, { nullable: true })
  thumbnailImage?: FileUpload | null;

  @IsOptional()
  @Field(() => GraphQLUpload, { nullable: true })
  bannerImage?: FileUpload | null;
}

@ArgsType()
export class AdminUpdateCollectionArgs {
  @IsUUID()
  @Field()
  collectionId: string;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  isWoVCollection?: boolean | null;

  @IsOptional()
  @Field({ nullable: true })
  brandId?: string | null;
}
