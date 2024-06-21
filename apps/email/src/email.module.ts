import { GrpcOptionsModule } from '@app/grpc-options';
import { SendGridModule } from '@app/sendgrid';
import { TracingModule } from '@app/tracing';
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/email';
import { MetricsController } from 'common/metrics.controller';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  imports: [
    SendGridModule.forRoot(SendGridModule, {
      enabled: process.env.SENDGRID_ENABLED?.toLowerCase() == 'true',
      apiKey: process.env.SENDGRID_API_KEY,
      defaultMailData: {
        from: {
          name: process.env.SENDGRID_DEFAULT_SENDER_NAME,
          email: process.env.SENDGRID_DEFAULT_SENDER_EMAIL,
        },
      },
    }),
    TracingModule.register('email'),
    GrpcOptionsModule,
  ],
  controllers: [EmailController, MetricsController],
  providers: [PrismaClient, EmailService],
})
export class EmailModule {}
