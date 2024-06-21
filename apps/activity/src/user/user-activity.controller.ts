import {
  GetUserActivityArgs,
  UserActivityServiceController,
  UserActivityServiceControllerMethods,
} from '@generated/ts-proto/services/activity';
import { Controller } from '@nestjs/common';
import { UserActivityService } from './user-activity.service';

@Controller()
@UserActivityServiceControllerMethods()
export class UserActivityController implements UserActivityServiceController {
  constructor(private readonly activityService: UserActivityService) {}

  async getActivity(args: GetUserActivityArgs) {
    return this.activityService.getActivity(args);
  }
}
