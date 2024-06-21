import { ArgsType, Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client/offer';
import { GraphQLDecimal } from 'prisma-graphql-type-decimal';
import { AssetDTO } from '../common/asset.response';
import { OfferType } from './offer-type.enum';

export enum OfferStatus {
  ACTIVE = 'ACTIVE',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(OfferStatus, { name: 'OfferStatus', description: undefined });

export enum OfferCurrency {
  WoV = 'WoV',
  vVET = 'vVET',
}

registerEnumType(OfferCurrency, { name: 'OfferCurrency' });

@ObjectType()
export class OfferBidderDTO {
  @Field()
  address: string;

  @Field({ nullable: true })
  name?: string | null;
}

@ObjectType()
export class OfferCollectionDTO {
  @Field()
  collectionId: string;

  @Field()
  smartContractAddress: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  thumbnailImageUrl?: string | null;
}

@ObjectType()
export class OfferTokenDTO {
  @Field()
  smartContractAddress: string;

  @Field()
  tokenId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  rank?: number | null;
}

@ObjectType()
export class OfferEditionDTO {
  @Field()
  smartContractAddress: string;

  @Field()
  tokenId: string;

  @Field()
  editionId: string;

  @Field()
  ownerAddress: string;

  @Field()
  tokenName: string;

  @Field({ nullable: true })
  stakingContractAddress?: string | null;

  @Field(() => String, { nullable: true })
  auctionId?: string | null;

  @Field(() => String, { nullable: true })
  saleId?: string | null;

  @Field(() => String, { nullable: true })
  saleAddressVIP180?: string | null;

  @Field(() => Number, { nullable: true })
  royalty?: number | null;

  @Field(() => Number, { nullable: true })
  rank?: number | null;

  @Field(() => AssetDTO)
  asset: AssetDTO;
}

@ObjectType()
export class HighestOfferDTO {
  @Field(() => GraphQLDecimal, { nullable: true })
  price: Prisma.Decimal | number | string | null;

  @Field({ nullable: true })
  addressVIP180?: string | null;
}

@ArgsType()
@ObjectType()
export class OfferDTO {
  @Field()
  offerId: string;

  @Field({ nullable: true })
  tokenId?: string | null;

  @Field({ nullable: true })
  editionId?: string | null;

  @Field()
  smartContractAddress: string;

  @Field()
  bidderAddress: string;

  @Field({ nullable: true })
  acceptorAddress?: string | null;

  @Field(() => GraphQLDecimal)
  price: Prisma.Decimal | number | string;

  @Field({ nullable: true })
  addressVIP180?: string | null;

  @Field(() => String)
  startingTime: Date | string;

  @Field(() => String)
  endTime: Date | string;

  @Field(() => OfferType)
  type: OfferType;

  @Field(() => OfferStatus)
  status: OfferStatus;

  // @Field(() => Number, { nullable: true })
  // createdAt: number | null;

  // @Field(() => Number, { nullable: true })
  // updatedAt: number | null;

  @Field(() => AssetDTO, { nullable: true })
  asset?: AssetDTO | null;

  @Field(() => OfferBidderDTO, { nullable: true })
  bidder?: OfferBidderDTO | null;

  @Field(() => OfferTokenDTO, { nullable: true })
  token?: OfferTokenDTO | null;

  @Field(() => OfferCollectionDTO, { nullable: true })
  collection?: OfferCollectionDTO | null;

  // These are all the possible editions that could be used to accept the offer.
  @Field(() => [OfferEditionDTO], { nullable: true })
  editions?: OfferEditionDTO[] | null;

  @Field(() => HighestOfferDTO, { nullable: true })
  highestOffer?: HighestOfferDTO | null;

  @Field(() => OfferCurrency, { nullable: true })
  currency?: OfferCurrency | null;
}
