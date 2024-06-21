import { SendGridService } from '@app/sendgrid';
import { Injectable, Logger } from '@nestjs/common';
import {
  EmailStatus,
  PrismaClient,
  TemplateKey,
  Templates,
} from '@prisma/client/email';
import { EmailData } from '@sendgrid/helpers/classes/email-address';
import { MailData } from '@sendgrid/helpers/classes/mail';
import knex from 'knex';
import _ from 'lodash';
import objectHash from 'object-hash';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sg: SendGridService,
  ) {}

  // TODO: Check the email from the database that has status equal to SENT and retry the FAILED one
  public async send(key: TemplateKey, data: Partial<MailData>) {
    const template = await this.prisma.templates.findUnique({ where: { key } });

    if (!template) {
      this.logger.warn(`Couldn't find any template linked to key "${key}"`);

      return false;
    }

    if (!template.isEnabled) {
      this.logger.warn(
        `The template ${template.templateId} associated to key ${template.key} is not enabled`,
      );

      return false;
    }

    data.templateId = template.templateId;

    // Transform plain "to" into "personalizations.to"
    if (!data.personalizations?.length) {
      if (Array.isArray(data.to)) {
        data.personalizations = data.to.map((recipient: EmailData) => ({
          to: _.isString(recipient) ? { email: recipient } : recipient,
        }));
      } else {
        data.personalizations = [
          _.isString(data.to) ? { to: { email: data.to } } : { to: data.to },
        ];
      }

      delete data.to;
    }

    // If there are some personalizations is a multi-send
    if (data.personalizations?.length) {
      // For each personalization calculate the ID and add it as customArgs
      for (const personalizations of data.personalizations) {
        const obj = {
          ...data.dynamicTemplateData,
          ...personalizations,
        };

        if (!personalizations.customArgs) {
          personalizations.customArgs = {};
        }

        personalizations.customArgs.id = objectHash({ key, obj });
      }

      // Get the sent email from the database
      const sentEmails = await this.prisma.email
        .findMany({
          where: {
            id: { in: data.personalizations.map((obj) => obj.customArgs.id) },
          },
        })
        .then((emails) => {
          emails.forEach((email) => {
            this.logger.warn(
              `[${email.key}] The email with ID "${email.id}" has already been sent`,
            );
          });

          return emails;
        });

      // Remove from the personalization all the email already sent
      data.personalizations = data.personalizations.filter(
        (personalization) =>
          !sentEmails.find(
            (email) => email.id === personalization.customArgs.id,
          ),
      );

      // Exit from the function if there are not any email to send
      if (!data.personalizations?.length) {
        return true;
      }
    }

    const emailIds = data.personalizations?.length
      ? data.personalizations.map(
          (personalization) => personalization.customArgs.id,
        )
      : [data.customArgs.id];

    const recipientEmails = data.personalizations?.length
      ? data.personalizations.flatMap((personalization) =>
          Array.isArray(personalization.to)
            ? personalization.to
            : [personalization.to],
        )
      : Array.isArray(data.to)
      ? data.to
      : [data.to];

    this.logger.log(
      `Sending ${
        data.personalizations?.length || 1
      } email(s) to:\n${recipientEmails.join(', ')}`,
    );

    // Send the email using SendGrid service
    return await this.sg
      .send(data, data.personalizations?.length > 1)
      .then(async () => {
        this.logger.verbose(
          `[${template.key}] Email(s) sent successfully\nId(s): ${emailIds.join(
            ', ',
          )}`,
        );

        await this.saveEmailToDatabase(
          template,
          data,
          EmailStatus.SENT,
          emailIds,
        );

        return true;
      })
      .catch(async (err) => {
        this.logger.error(
          `[${
            template.key
          }] An error occurred while sending email(s)\nId(s): ${emailIds.join(
            ', ',
          )}`,
          err,
        );

        await this.saveEmailToDatabase(
          template,
          data,
          EmailStatus.FAILED,
          emailIds,
        );

        return false;
      });
  }

  private async saveEmailToDatabase(
    template: Templates,
    data: Partial<MailData>,
    status?: EmailStatus,
    emailIds?: string[],
  ) {
    try {
      if (data.personalizations?.length) {
        const values = data.personalizations.map((personalizations) => ({
          id: personalizations.customArgs.id,
          key: template.key,
          data: JSON.stringify({
            ...data.dynamicTemplateData,
            ...personalizations,
          }),
          status: status || EmailStatus.UNKNOWN,
          failedReason: null,
        }));

        const upsertManyEmailQuery = knex({ client: 'pg' })
          .table('Email')
          .insert(values)
          .onConflict('id')
          .merge()
          .toString();

        // Execute the raw query
        await this.prisma.$queryRawUnsafe(upsertManyEmailQuery);
      } else {
        const upsertData = {
          id: data.customArgs.id,
          key: template.key,
          data: data.dynamicTemplateData,
          status: EmailStatus.SENT,
          failedReason: null as string | null,
        };

        await this.prisma.email.upsert({
          where: { id: data.customArgs.id },
          create: upsertData,
          update: upsertData,
        });
      }

      return true;
    } catch (err) {
      this.logger.warn(
        `[${
          template.key
        }] Couldn't save the sent email to the database\nId(s): ${emailIds.join(
          ', ',
        )}`,
        err,
      );

      return false;
    }
  }
}
