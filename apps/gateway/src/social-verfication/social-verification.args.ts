import { registerEnumType } from '@nestjs/graphql';

export enum SocialAccountProvider {
  TWITTER = 'TWITTER',
  DISCORD = 'DISCORD',
  INSTAGRAM = 'INSTAGRAM',
}

registerEnumType(SocialAccountProvider, { name: 'SocialAccountProvider' });
