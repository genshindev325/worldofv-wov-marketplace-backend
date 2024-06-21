import { OpenTelemetryModule } from '@metinseylan/nestjs-opentelemetry';
import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { PrismaInstrumentation } from '@prisma/instrumentation';

export class TracingModule {
  static register(serviceName: string): DynamicModule {
    return {
      module: TracingModule,
      imports: [
        OpenTelemetryModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const traceExporter = new JaegerExporter();

            const spanProcessor =
              configService.get('NODE_ENV') === 'production'
                ? new BatchSpanProcessor(traceExporter)
                : new SimpleSpanProcessor(traceExporter);

            return {
              serviceName,
              instrumentations: [new PrismaInstrumentation()],
              spanProcessor,
              traceExporter,
            };
          },
        }),
      ],
      exports: [OpenTelemetryModule],
    };
  }
}
