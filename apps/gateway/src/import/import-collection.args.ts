import { ArgsType, Field, registerEnumType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEthereumAddress,
  IsOptional,
  IsString,
  IsUrl,
  registerDecorator,
  validateOrReject,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';

export class StandardIpfsFetcherConfig {
  @IsUrl()
  ipfsGateway: string;
}

@ValidatorConstraint({ async: true })
export class ValidateFetcherConstraint implements ValidatorConstraintInterface {
  async validate(fetcherConfig: any, args: ValidationArguments) {
    switch ((args.object as ImportCollectionArgs).fetcher) {
      case FetcherType.STANDARD_IPFS:
        await validateOrReject(
          Object.assign(new StandardIpfsFetcherConfig(), fetcherConfig),
        );
    }

    return true;
  }
}

export function ValidateFetcher(validationOptions?: ValidationOptions) {
  return function (object: ImportCollectionArgs, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: ValidateFetcherConstraint,
    });
  };
}

export enum FetcherType {
  STANDARD_IPFS = 'STANDARD_IPFS',
  STANDARD_ARWEAVE = 'STANDARD_ARWEAVE',
  STANDARD_HTTP = 'STANDARD_HTTP',
}

registerEnumType(FetcherType, { name: 'FetcherType' });

@ArgsType()
export class ImportCollectionArgs {
  @IsEthereumAddress()
  @Field()
  smartContractAddress: string;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  creatorAddress?: string | null;

  @IsString()
  @Field()
  name: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  description?: string | null;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  customUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  mintPageUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  thumbnailImageUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  bannerImageUrl?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  burnContractAddress?: string | null;

  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  cooldownContractAddress?: string | null;

  @IsOptional()
  @Field(() => GraphQLDecimal, { nullable: true })
  minimumOffer?: string | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  isVerified?: boolean | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  isVisible?: boolean | null;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  isMinting?: boolean | null;

  @Field(() => FetcherType)
  fetcher: FetcherType;

  @ValidateFetcher()
  @Field(() => GraphQLJSON)
  fetcherConfig: any;
}
