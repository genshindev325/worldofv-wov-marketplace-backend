import {
  GetTokenActivityArgs,
  TokenActivityServiceController,
  TokenActivityServiceControllerMethods,
} from '@generated/ts-proto/services/activity';
import { Controller } from '@nestjs/common';
import { TokenActivityService } from './token-activity.service';

@Controller()
@TokenActivityServiceControllerMethods()
export class TokenActivityController implements TokenActivityServiceController {
  constructor(private readonly activityService: TokenActivityService) {}

  async getActivity(args: GetTokenActivityArgs) {
    return this.activityService.getActivity(args);
  }
}
