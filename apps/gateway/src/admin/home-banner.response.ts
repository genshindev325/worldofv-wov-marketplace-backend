import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HomeBanner {
  @Field()
  id: string;

  @Field()
  image: string;

  @Field(() => Int)
  position: number;

  @Field({ nullable: true })
  collectionId: string | null;

  @Field({ nullable: true })
  artist: string | null;

  @Field({ nullable: true })
  url: string | null;
}
