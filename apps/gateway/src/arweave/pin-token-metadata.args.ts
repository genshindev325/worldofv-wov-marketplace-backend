import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@ValidatorConstraint()
class StringOrNumber implements ValidatorConstraintInterface {
  validate(text: unknown) {
    switch (typeof text) {
      case 'string':
      case 'number':
        return true;
      default:
        return false;
    }
  }
}

@InputType()
export class TokenAttribute {
  @Field({ nullable: true })
  display_type?: string;

  @Field()
  trait_type: string;

  @Field(() => GraphQLJSON)
  @Validate(StringOrNumber)
  value: string | number;
}

@ArgsType()
export default class PinTokenMetadataArgs {
  @Field(() => GraphQLUpload)
  image: Promise<FileUpload>;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  collectionName?: string;

  @Field(() => [TokenAttribute], { nullable: true })
  @Type(() => TokenAttribute)
  @ValidateNested({ each: true })
  attributes?: TokenAttribute[];

  @Field(() => [String], { nullable: true })
  categories?: string[];
}
