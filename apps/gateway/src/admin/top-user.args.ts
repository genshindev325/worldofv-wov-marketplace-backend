import { TopUserKind } from '@generated/ts-proto/services/admin';
import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsEthereumAddress, IsInt, IsPositive } from 'class-validator';

@ArgsType()
export class GetAllTopUsersArgs {
  @IsEnum(TopUserKind)
  @Field(() => TopUserKind)
  kind: TopUserKind;
}

@ArgsType()
export class UpsertTopUserArgs {
  @IsEnum(TopUserKind)
  @Field(() => TopUserKind)
  kind: TopUserKind;

  @IsEthereumAddress()
  @Field()
  address: string;

  @IsPositive()
  @IsInt()
  @Field(() => Int)
  position: number;
}

@ArgsType()
export class DeleteTopUserArgs {
  @IsEnum(TopUserKind)
  @Field(() => TopUserKind)
  kind: TopUserKind;

  @IsEthereumAddress()
  @Field()
  address: string;
}
