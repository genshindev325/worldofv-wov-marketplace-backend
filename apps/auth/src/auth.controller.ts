import {
  AuthServiceController,
  AuthServiceControllerMethods,
  ValidateCertificateArgs,
} from '@generated/ts-proto/services/auth';
import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
@AuthServiceControllerMethods()
export class AuthController implements AuthServiceController {
  constructor(private readonly authService: AuthService) {}

  async login(args: ValidateCertificateArgs) {
    return await this.authService.login(args as CertificateData);
  }
}
