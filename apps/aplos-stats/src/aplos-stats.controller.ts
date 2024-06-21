import {
  AplosStatsServiceController,
  AplosStatsServiceControllerMethods,
} from '@generated/ts-proto/services/aplos_stats';
import { Controller } from '@nestjs/common';
import { GetCollectionsStatsArgs } from 'apps/gateway/src/aplos-stats/get-collections-stats.args';
import { AplosStatsService } from './aplos-stats.service';
@Controller()
@AplosStatsServiceControllerMethods()
export class AplosStatsController implements AplosStatsServiceController {
  constructor(private readonly aplosStatsService: AplosStatsService) {}

  async getCollectionsStats(args: GetCollectionsStatsArgs) {
    const collectionStats = await this.aplosStatsService.getCollectionsStats(
      args,
    );
    return { collectionStats };
  }

  async getBuyersStats(args: GetCollectionsStatsArgs) {
    const buyersStats = await this.aplosStatsService.getBuyersStats(args);
    return { buyersStats };
  }

  async getCurrentMonthFees() {
    const fees = await this.aplosStatsService.getCurrentMonthFees();
    return { fees };
  }
}
