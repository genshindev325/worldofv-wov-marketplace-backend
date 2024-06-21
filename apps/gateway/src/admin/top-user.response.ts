import { TopUserKind } from '@generated/ts-proto/services/admin';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from 'apps/gateway/src/user/user.response';

registerEnumType(TopUserKind, { name: 'TopUserKind' });

@ObjectType()
export class TopUser {
  @Field(() => TopUserKind)
  kind: TopUserKind;

  @Field()
  address: string;

  @Field(() => Int)
  position: number;

  @Field(() => User, { nullable: true })
  user?: User | null;
}
