import { registerEnumType } from '@nestjs/graphql';

export enum CollectionType {
  MARKETPLACE = 'MARKETPLACE',
  EXTERNAL = 'EXTERNAL',
}

registerEnumType(CollectionType, { name: 'CollectionType' });
