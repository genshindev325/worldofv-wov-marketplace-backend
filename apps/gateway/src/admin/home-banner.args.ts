import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsPositive, IsUrl, IsUUID } from 'class-validator';

@ArgsType()
export class CreateHomeBannerArgs {
  @IsUrl()
  @Field()
  image: string;

  @IsPositive()
  @IsInt()
  @Field(() => Int)
  position: number;

  @IsOptional()
  @Field({ nullable: true })
  collectionId: string | null;

  @IsOptional()
  @Field({ nullable: true })
  artist: string | null;

  @IsOptional()
  @Field({ nullable: true })
  url: string | null;
}

@ArgsType()
export class UpdateHomeBannerArgs {
  @IsUUID()
  @Field()
  id: string;

  @IsOptional()
  @IsUrl()
  @Field({ nullable: true })
  image: string | null;

  @IsOptional()
  @IsPositive()
  @IsInt()
  @Field(() => Int, { nullable: true })
  position: number | null;

  @IsOptional()
  @Field({ nullable: true })
  collectionId: string | null;

  @IsOptional()
  @Field({ nullable: true })
  artist: string | null;

  @IsOptional()
  @Field({ nullable: true })
  url: string | null;
}

@ArgsType()
export class DeleteHomeBannerArgs {
  @IsUUID()
  @Field()
  id: string;
}
