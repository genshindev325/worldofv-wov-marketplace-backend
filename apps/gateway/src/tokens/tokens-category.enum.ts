import { registerEnumType } from '@nestjs/graphql';

export enum TokensCategory {
  ART = 'ART',
  PFP = 'PFP',
  PHOTO = 'PHOTO',
  MUSIC = 'MUSIC',
  GAME = 'GAME',
  COLLECTIBLE = 'COLLECTIBLE',
  TRADING_CARD = 'TRADING_CARD',
  SPORT = 'SPORT',
  UTILITY = 'UTILITY',
  MEME = 'MEME',
  OTHER = 'OTHER',
  PHYGITAL = 'PHYGITAL',
}

registerEnumType(TokensCategory, { name: 'TokensCategory' });
