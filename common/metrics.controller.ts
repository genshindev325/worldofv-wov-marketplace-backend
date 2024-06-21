import { PrismaClient as PrismaClientAdmin } from '@prisma/client/admin';
import { PrismaClient as PrismaClientAplos } from '@prisma/client/aplos-stats';
import { PrismaClient as PrismaClientAuction } from '@prisma/client/auction';
import { PrismaClient as PrismaClientBlockchain } from '@prisma/client/blockchain';
import { PrismaClient as PrismaClientBusiness } from '@prisma/client/business';
import { PrismaClient as PrismaClientEmail } from '@prisma/client/email';
import { PrismaClient as PrismaClientThumbnail } from '@prisma/client/image-thumbnail';
import { PrismaClient as PrismaClientMarketplace } from '@prisma/client/marketplace';
import { PrismaClient as PrismaClientNft } from '@prisma/client/nft';
import { PrismaClient as PrismaClientOffer } from '@prisma/client/offer';
import { PrismaClient as PrismaClientPriceConversion } from '@prisma/client/price-conversion';
import { PrismaClient as PrismaClientSale } from '@prisma/client/sale';
import { PrismaClient as PrismaClientUser } from '@prisma/client/user';
import PrismaClientMarketplaceSync from 'apps/marketplace-sync/src/prisma-client-marketplace-sync';

import { Controller, Get, Logger, Optional } from '@nestjs/common';

@Controller()
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  private readonly clients: { client: any; label: string }[];

  constructor(
    @Optional() clientAdmin: PrismaClientAdmin,
    @Optional() clientAplos: PrismaClientAplos,
    @Optional() clientAuction: PrismaClientAuction,
    @Optional() clientBlockchain: PrismaClientBlockchain,
    @Optional() clientBusiness: PrismaClientBusiness,
    @Optional() clientEmail: PrismaClientEmail,
    @Optional() clientMarketplace: PrismaClientMarketplace,
    @Optional() clientMarketplaceSync: PrismaClientMarketplaceSync,
    @Optional() clientNft: PrismaClientNft,
    @Optional() clientOffer: PrismaClientOffer,
    @Optional() clientPriceConversion: PrismaClientPriceConversion,
    @Optional() clientSale: PrismaClientSale,
    @Optional() clientThumbnail: PrismaClientThumbnail,
    @Optional() clientUser: PrismaClientUser,
  ) {
    this.clients = [
      { client: clientAdmin, label: 'admin' },
      { client: clientAplos, label: 'aplos-stats' },
      { client: clientAuction, label: 'auction' },
      { client: clientBlockchain, label: 'blockchain' },
      { client: clientBusiness, label: 'business' },
      { client: clientEmail, label: 'email' },
      { client: clientMarketplace, label: 'marketplace' },
      { client: clientMarketplaceSync, label: 'marketplace-sync' },
      { client: clientNft, label: 'nft' },
      { client: clientOffer, label: 'offer' },
      { client: clientPriceConversion, label: 'price-conversion' },
      { client: clientSale, label: 'sale' },
      { client: clientThumbnail, label: 'image-thumbnail' },
      { client: clientUser, label: 'user' },
    ];
  }

  @Get('/metrics')
  async getMetrics() {
    let metrics = '';

    for (const { client, label } of this.clients) {
      if (client) {
        metrics += await client.$metrics.prometheus({
          globalLabels: { client: label },
        });
      }
    }

    return metrics;
  }
}
