import { registerEnumType } from '@nestjs/graphql';

export enum UsersVerifiedStatus {
  NOT_VERIFIED = 'NOT_VERIFIED',
  VERIFIED = 'VERIFIED',
  CURATED = 'CURATED',
}

registerEnumType(UsersVerifiedStatus, { name: 'UsersVerifiedStatus' });
