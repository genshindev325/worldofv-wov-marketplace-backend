import {
  BlockchainStatsServiceController,
  BlockchainStatsServiceControllerMethods,
  GetSalesVolumeArgs,
} from '@generated/ts-proto/services/blockchain_stats';
import { Controller } from '@nestjs/common';
import { BlockchainStatsService } from './blockchain-stats.service';

@Controller()
@BlockchainStatsServiceControllerMethods()
export class BlockchainStatsController
  implements BlockchainStatsServiceController
{
  constructor(
    private readonly blockchainStatsService: BlockchainStatsService,
  ) {}

  async getSalesVolume(args: GetSalesVolumeArgs) {
    const sales = await this.blockchainStatsService.getSales(args);
    const offers = await this.blockchainStatsService.getOffers(args);
    const auctions = await this.blockchainStatsService.getAuctions(args);

    return { sales, offers, auctions };
  }
}
