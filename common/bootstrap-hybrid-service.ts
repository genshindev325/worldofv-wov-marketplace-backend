import { GrpcOptionsService } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Queue } from 'bullmq';

export interface BootstrapHybridServiceArgs {
  Module: any;
  grpcClientKind?: GrpcClientKind;
  httpPortKey?: string;
  queueNames?: string[];
}

export default async function bootstrapHybridService({
  Module,
  grpcClientKind,
  httpPortKey,
  queueNames,
}: BootstrapHybridServiceArgs) {
  const logger = new Logger(Module.name);
  const app = await NestFactory.create(Module);

  app.useLogger(logger);

  if (grpcClientKind) {
    const grpcOptionsService = app.get(GrpcOptionsService);
    const grpcOptions = grpcOptionsService.getGrpcOptions(grpcClientKind);

    app.connectMicroservice(grpcOptions);

    await app.startAllMicroservices();
    logger.log(`RPC listening on ${grpcOptions.options.url}`);
  }

  if (queueNames) {
    const serverAdapter = new ExpressAdapter();
    const queues = queueNames.map((q) => app.get<Queue>(`BullQueue_${q}`));
    const adapters = queues.map((queue) => new BullMQAdapter(queue));
    createBullBoard({ queues: adapters, serverAdapter });
    serverAdapter.setBasePath('/');
    app.use('/', serverAdapter.getRouter());
  }

  if (httpPortKey) {
    const configService = app.get(ConfigService);
    const port = configService.getOrThrow(httpPortKey);

    await app.listen(port, '0.0.0.0');

    const listeningOn = await app.getUrl();
    logger.log(`HTTP listening on ${listeningOn}`);
  }
}
