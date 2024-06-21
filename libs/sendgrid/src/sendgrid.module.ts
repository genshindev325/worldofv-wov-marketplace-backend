import { createConfigurableDynamicRootModule } from '@golevelup/nestjs-modules';
import { Module } from '@nestjs/common';
import {
  SendGridModuleOptions,
  SENDGRID_MODULE_OPTIONS,
} from './sendgrid.config';
import { SendGridService } from './sendgrid.service';

@Module({
  providers: [SendGridService],
  exports: [SendGridService],
})
export class SendGridModule extends createConfigurableDynamicRootModule<
  SendGridModule,
  SendGridModuleOptions
>(SENDGRID_MODULE_OPTIONS) {}
