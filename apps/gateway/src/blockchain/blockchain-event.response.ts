import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

export enum BlockchainEventStatus {
  SAVED = 'SAVED',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
  STOPPED = 'STOPPED',
}

registerEnumType(BlockchainEventStatus, { name: 'BlockchainEventStatus' });

@ObjectType()
export class BlockchainEvent {
  @Field(() => ID, { nullable: false })
  jobId: string;

  @Field(() => String, { nullable: false })
  address: string;

  @Field(() => String, { nullable: false })
  event: string;

  @Field(() => String, { nullable: false })
  signature: string;

  @Field(() => GraphQLJSON, { nullable: false })
  returnValues: any;

  @Field(() => GraphQLJSON, { nullable: false })
  meta: any;

  @Field(() => GraphQLJSON, { nullable: false })
  raw: any;

  @Field(() => BlockchainEventStatus, { nullable: false })
  status: keyof typeof BlockchainEventStatus;
}
