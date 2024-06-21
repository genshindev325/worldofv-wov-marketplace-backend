import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress } from 'class-validator';

@InputType()
export class AnnexArgs {
  @Field()
  domain: string;

  @IsEthereumAddress()
  @Field()
  signer: string;

  @Field()
  timestamp: number;
}

@ArgsType()
export class ValidateCertificateArgs {
  @Field(() => AnnexArgs)
  annex: AnnexArgs;

  @Field()
  signature: string;
}
