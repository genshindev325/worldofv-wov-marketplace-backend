import {
  BusinessServiceController,
  BusinessServiceControllerMethods,
  CheckSecretCodeArgs,
  ConsumeSecretCodeArgs,
  CreateClientArgs,
} from '@generated/ts-proto/services/business';
import { Controller } from '@nestjs/common';
import { decodeSerializedJson } from 'common/serialized-json';
import { BusinessService } from './business.service';

@Controller()
@BusinessServiceControllerMethods()
export class BusinessController implements BusinessServiceController {
  constructor(private readonly businessService: BusinessService) {}

  createClient(args: CreateClientArgs) {
    return this.businessService.createClient(args);
  }

  checkSecretCode(args: CheckSecretCodeArgs) {
    return this.businessService.checkSecretCode(args);
  }

  consumeSecretCode({ metadata: encoded, ...args }: ConsumeSecretCodeArgs) {
    const metadata = decodeSerializedJson<any>(encoded);
    return this.businessService.consumeSecretCode({ metadata, ...args });
  }
}
