import { Inject, Injectable, Logger } from '@nestjs/common';
import sgMail, {
  ClientResponse,
  MailDataRequired,
  ResponseError,
} from '@sendgrid/mail';
import _ from 'lodash';
import {
  SendGridModuleOptions,
  SENDGRID_MODULE_OPTIONS,
} from './sendgrid.config';

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);

  constructor(
    @Inject(SENDGRID_MODULE_OPTIONS)
    private readonly options: SendGridModuleOptions,
  ) {
    if (!options.enabled) {
      this.logger.warn('The SendGrid service is not enabled');
      return;
    }

    if (!options.apiKey) {
      this.logger.error('The API_KEY was not provided to the service');
      return;
    }

    sgMail.setApiKey(options.apiKey);
  }

  public async send(
    data: Partial<MailDataRequired> | Partial<MailDataRequired>[],
    isMultiple?: boolean,
    cb?: (
      err: Error | ResponseError,
      result: [ClientResponse, Record<string, unknown>],
    ) => void,
  ): Promise<[ClientResponse, Record<string, unknown>]> {
    if (Array.isArray(data)) {
      const payload = data.map((d) =>
        this.mergeWithDefaultMailData(d),
      ) as MailDataRequired[];

      this.logger.log(`Sending an array of email ${JSON.stringify(payload)}`);

      return sgMail.send(payload, isMultiple, cb);
    } else if (isMultiple) {
      return this.sendMultiple(data);
    } else {
      const payload = this.mergeWithDefaultMailData(data) as MailDataRequired;

      this.logger.log(`Sending single email ${JSON.stringify(payload)}`);

      return sgMail.send(payload, isMultiple, cb);
    }
  }

  public async sendMultiple(
    data: Partial<MailDataRequired>,
    cb?: (
      error: Error | ResponseError,
      result: [ClientResponse, Record<string, unknown>],
    ) => void,
  ): Promise<[ClientResponse, Record<string, unknown>]> {
    const payload = this.mergeWithDefaultMailData(data) as MailDataRequired;

    this.logger.log(`Sending multiple emails ${JSON.stringify(payload)}`);

    return sgMail.sendMultiple(payload, cb);
  }

  private mergeWithDefaultMailData(
    data: Partial<MailDataRequired>,
  ): MailDataRequired {
    if (!this.options.defaultMailData) {
      return data as MailDataRequired;
    }

    return _.merge({}, this.options.defaultMailData as MailDataRequired, data);
  }
}
