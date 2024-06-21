import { VerifiedStatus } from '@generated/ts-proto/types/user';
import { Field, ObjectType } from '@nestjs/graphql';
import { AssetDTO } from './asset.response';

@ObjectType()
export class MarketplaceUser {
  @Field()
  address: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  customUrl?: string;

  @Field({ defaultValue: false })
  blacklisted?: boolean;

  @Field({ defaultValue: false })
  verified?: boolean;

  @Field(() => VerifiedStatus, { defaultValue: VerifiedStatus.NOT_VERIFIED })
  verifiedLevel?: VerifiedStatus;

  @Field(() => [AssetDTO])
  assets: AssetDTO[];
}
