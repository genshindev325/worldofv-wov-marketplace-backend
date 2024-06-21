import { ArgsType, Field } from '@nestjs/graphql';
import {
  Equals,
  IsBoolean,
  IsObject,
  IsString,
  ValidateIf,
} from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

@ArgsType()
export class AdminCreateClientArgs {
  @Field()
  @IsString()
  id: string;

  @Field()
  @IsBoolean()
  @Equals(true)
  @ValidateIf((o) => !o.disposableCodes)
  uniqueClaimer: boolean;

  @Field()
  @IsBoolean()
  @Equals(true)
  @ValidateIf((o) => !o.uniqueClaimer)
  disposableCodes: boolean;

  @Field(() => [String])
  @IsString({ each: true })
  secretCodes: string[];
}

@ArgsType()
export class CheckSecretCodeArgs {
  @Field()
  @IsString()
  clientId: string;

  @Field()
  @IsString()
  secretCode: string;
}

@ArgsType()
export class ConsumeSecretCodeArgs extends CheckSecretCodeArgs {
  @Field(() => GraphQLJSONObject)
  @IsObject()
  metadata: any;
}
