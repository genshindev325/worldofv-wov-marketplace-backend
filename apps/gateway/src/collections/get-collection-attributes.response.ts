import { Field, Int, ObjectType } from '@nestjs/graphql';
import { IsArray } from 'class-validator';

@ObjectType()
class CollectionTokenAttributesValue {
  @Field()
  value: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class CollectionTokenAttributesItem {
  @Field()
  key: string;

  @IsArray()
  @Field(() => [CollectionTokenAttributesValue])
  values: CollectionTokenAttributesValue[];
}
