import { registerEnumType } from '@nestjs/graphql';

export enum OfferType {
  EDITION = 'EDITION',
  TOKEN = 'TOKEN',
  COLLECTION = 'COLLECTION',
}

registerEnumType(OfferType, { name: 'OfferType', description: undefined });
