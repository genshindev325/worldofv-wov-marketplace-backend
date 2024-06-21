import { MailData } from '@sendgrid/helpers/classes/mail';

export const SENDGRID_MODULE_OPTIONS = 'SENDGRID_MODULE_OPTIONS';

export interface SendGridModuleOptions {
  enabled?: boolean;
  apiKey?: string;
  defaultMailData?: MailData;
}
