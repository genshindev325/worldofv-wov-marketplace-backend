import {
  CollectionActivityServiceController,
  CollectionActivityServiceControllerMethods,
  GetCollectionActivityArgs,
} from '@generated/ts-proto/services/activity';
import { Controller } from '@nestjs/common';
import { CollectionActivityService } from './collection-activity.service';

@Controller()
@CollectionActivityServiceControllerMethods()
export class CollectionActivityController
  implements CollectionActivityServiceController
{
  constructor(private readonly activityService: CollectionActivityService) {}

  async getActivity(args: GetCollectionActivityArgs) {
    return this.activityService.getActivity(args);
  }

  async getRecepientCountForCollection(args: GetCollectionActivityArgs) {
    return this.activityService.getRecepientCountForCollection(args);
  }

  async getLastTransfersForCollection(args: GetCollectionActivityArgs) {
    return this.activityService.getLastTransfersForCollection(args);
  }
}
