import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsEthereumAddress, IsOptional } from 'class-validator';

@ArgsType()
@InputType()
export class GetWoVCollectionsArgs {
  @IsOptional()
  @IsEthereumAddress()
  @Field({ nullable: true })
  ownerAddress?: string | null;

  @IsOptional()
  @Field({ nullable: true })
  brandId?: string | null;
}
