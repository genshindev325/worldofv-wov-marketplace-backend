import { Field, ObjectType } from '@nestjs/graphql';
import { User } from 'apps/gateway/src/user/user.response';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';

@ObjectType()
export class AuctionHistory {
  @Field()
  id: string;

  @Field()
  event: string;

  @Field()
  timestamp: number;

  @Field()
  txID: string;

  @Field()
  auctionId: string;

  @Field()
  smartContractAddress: string;

  @Field()
  tokenId: string;

  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field(() => GraphQLDecimal, { nullable: true })
  price?: string | null;

  @Field({ nullable: true })
  updatedDate?: string | null;
}
