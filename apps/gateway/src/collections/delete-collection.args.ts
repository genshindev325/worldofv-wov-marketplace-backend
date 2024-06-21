import { ArgsType, Field } from '@nestjs/graphql';
import { IsOptional, IsUUID } from 'class-validator';

@ArgsType()
export class DeleteCollectionArgs {
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  collectionId?: string | null;
}
