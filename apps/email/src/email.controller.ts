import {
  EmailServiceController,
  EmailServiceControllerMethods,
  SendEmailArgs,
} from '@generated/ts-proto/services/email';
import { Controller } from '@nestjs/common';
import { TemplateKey } from '@prisma/client/email';
import { MailData } from '@sendgrid/helpers/classes/mail';
import { decodeSerializedJson } from 'common/serialized-json';
import { EmailService } from './email.service';

@Controller()
@EmailServiceControllerMethods()
export class EmailController implements EmailServiceController {
  constructor(private readonly emailService: EmailService) {}

  public async send(args: SendEmailArgs) {
    const value = await this.emailService.send(
      args.key as TemplateKey,
      args.data
        ? decodeSerializedJson<Partial<MailData>>(args.data)
        : undefined,
    );

    return { value };
  }
}
