import { PrismaClient } from '@prisma/client/marketplace';

export default class PrismaClientMarketplaceSync extends PrismaClient {
  constructor() {
    super({
      datasources: { db: { url: process.env.MARKETPLACE_SYNC_DATABASE_URL } },
    });
  }
}
