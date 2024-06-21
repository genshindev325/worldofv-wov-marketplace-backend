import { WEB3_CLIENT } from '@app/web3';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BlockchainEventStatus, PrismaClient } from '@prisma/client/blockchain';
import { Queue } from 'bullmq';
import { isSameAddress } from 'common/is-same-address.helper';
import knex from 'knex';
import _ from 'lodash';
import objectHash from 'object-hash';
import { ThorifyContract, ThorifyWeb3 } from 'thorify';

interface HandleEventsArgs {
  contract: ThorifyContract;
  eventName: string;
}

interface Subscription {
  contract: ThorifyContract;
  eventName: string;
  fromBlock: number;
}

@Injectable()
export class BlockchainSyncBaseProducer implements OnModuleInit {
  protected readonly logger = new Logger(BlockchainSyncBaseProducer.name);

  // WARNING: make sure this value is not too high or the node will start
  // returning incomplete results!
  private SYNC_PAST_EVENTS_CHUNK_SIZE =
    Number(process.env.BLOCKCHAIN_SYNC_PAST_EVENTS_CHUNK_SIZE) || 128;

  private SYNC_DATABASE_CHUNK_SIZE =
    Number(process.env.BLOCKCHAIN_SYNC_DATABASE_CHUNK_SIZE) || 1024;

  private readonly subscriptions: Subscription[] = [];

  @Inject(WEB3_CLIENT) protected readonly web3: ThorifyWeb3;

  @Inject(PrismaClient) protected readonly prisma: PrismaClient;

  constructor(protected readonly queue: Queue) {}

  async onModuleInit() {
    await this.flushQueue();
    this.listenForNewBlocks();
  }

  private async flushQueue() {
    this.logger.log(
      `[${this.onModuleInit.name}] Flushing queue before starting.`,
    );

    await this.queue.pause();
    await this.queue.drain(true);
    await this.queue.clean(0, Number.MAX_SAFE_INTEGER, 'active');
    await this.queue.clean(0, Number.MAX_SAFE_INTEGER, 'paused');
    await this.queue.clean(0, Number.MAX_SAFE_INTEGER, 'failed');
    await this.queue.clean(0, Number.MAX_SAFE_INTEGER, 'completed');
    await this.queue.resume();

    this.logger.log(`[${this.onModuleInit.name}] Queue flushed successfully.`);
  }

  private listenForNewBlocks(retries = 1) {
    this.web3.eth.subscribe('newBlockHeaders', undefined, (error) => {
      if (error) {
        this.logger.error(
          `[${this.listenForNewBlocks.name}] Error subscribing to 'newBlockHeaders', retrying in ${retries}s`,
          error?.message || error,
        );
        setTimeout(() => this.listenForNewBlocks(retries + 1), retries * 1000);
      } else {
        for (const subscription of this.subscriptions) {
          this.processSubscription(subscription);
        }
      }
    });
  }

  private async processSubscription(subscription: Subscription) {
    const { contract, eventName, fromBlock } = subscription;

    const { totalCount, latestBlockNumber } = await this.processEvents(
      contract,
      eventName,
      fromBlock,
    );

    if (totalCount) {
      this.logger.log(
        `[${this.handleEvents.name}] Found ${totalCount} new event(s) for '${contract.options.address}/${eventName}'`,
      );
    }

    if (latestBlockNumber) subscription.fromBlock = latestBlockNumber + 1;
  }

  private async getLastBlockFromDatabase(
    smartContractAddress: string,
    eventName: string,
  ) {
    const res = await this.prisma.$queryRaw<[{ blockNumber: string }]>`
      SELECT MAX(("meta"->>'blockNumber')::INT) AS "blockNumber"
      FROM "BlockchainEvent"
      WHERE address = ${smartContractAddress}::CITEXT AND "event" = ${eventName}
    `;

    if (res?.[0]?.blockNumber) return parseInt(res[0].blockNumber);
    else return 0;
  }

  /**
   * Retrieve a hash that uniquely identifies the event object.
   */
  private getEventHash(rawEvent: any) {
    return objectHash(
      _.pick(rawEvent, [
        'address',
        'meta',
        'returnValues',
        'event',
        'signature',
        'raw',
      ]),
    );
  }

  private async processEvents(
    contract: ThorifyContract,
    eventName: string,
    fromBlock: number,
    toBlock: number | string = 'latest',
  ) {
    let totalCount = 0;
    let latestBlockNumber = null;

    // We process events in chunks to make sure we don't fill up memory during
    // the initial sync. Also if we request too much data at once the node
    // will start returning weird results.
    for (let offset = 0; ; offset += this.SYNC_PAST_EVENTS_CHUNK_SIZE) {
      const events = await contract.getPastEvents(eventName, {
        fromBlock,
        toBlock,
        options: { offset, limit: this.SYNC_PAST_EVENTS_CHUNK_SIZE },
      });

      if (!events.length) break;

      totalCount += events.length;
      latestBlockNumber = events[events.length - 1].blockNumber;

      let eventData = events.map((event) => ({
        address: event.address,
        meta: event.meta,
        returnValues: event.returnValues,
        event: event.event,
        signature: event.signature,
        raw: event.raw,
        jobId: this.getEventHash(event),
      }));

      // Sometimes the event list returned by the node contains the same exact
      // event duplicated twice. Not sure if this is a bug on the node but we
      // work around it by filtering duplicates.
      eventData = _.uniqBy(eventData, 'jobId');

      // We use a raw query for inserts since sometimes the services crash
      // because of a collision on `jobId`. I haven't been able to figure out
      // why that happens so we force the insertion for now.
      const insertQuery = knex({ client: 'pg' })
        .insert(
          eventData.map((event) => ({
            ...event,
            meta: JSON.stringify(event.meta),
            returnValues: JSON.stringify(event.returnValues),
            status: BlockchainEventStatus.SAVED,
          })),
        )
        .into('BlockchainEvent')
        .onConflict('jobId')
        .merge()
        .toString();

      await this.prisma.$queryRawUnsafe(insertQuery);

      await this.queue.addBulk(
        eventData.map(({ jobId, ...event }) => ({
          name: eventName,
          data: event,
          opts: { jobId },
        })),
      );
    }

    return { totalCount, latestBlockNumber };
  }

  private async retryDatabaseEvents(
    contract: ThorifyContract,
    eventName: string,
  ) {
    let totalCount = 0;

    for (let offset = 0; ; offset += this.SYNC_DATABASE_CHUNK_SIZE) {
      const events = await this.prisma.blockchainEvent.findMany({
        where: {
          event: eventName,
          address: contract.options.address,
          status: {
            in: [BlockchainEventStatus.FAILED, BlockchainEventStatus.SAVED],
          },
        },
        orderBy: { jobId: 'asc' },
        skip: offset,
        take: this.SYNC_DATABASE_CHUNK_SIZE,
      });

      if (!events.length) break;

      totalCount += events.length;

      await this.queue.addBulk(
        events.map((event) => ({
          name: eventName,
          data: event,
          opts: { jobId: event.jobId },
        })),
      );
    }

    return totalCount;
  }

  public async handleEvents({ contract, eventName }: HandleEventsArgs) {
    const existing = this.subscriptions.find(
      (s) =>
        isSameAddress(s.contract.options.address, contract.options.address) &&
        s.eventName === eventName,
    );

    if (existing) {
      this.logger.warn(
        `[${this.handleEvents.name}] Event '${contract.options.address}/${eventName}' already subscribed, skipping.`,
      );
      return;
    } else {
      this.logger.log(
        `[${this.handleEvents.name}] Subscribing to '${contract.options.address}/${eventName}'.`,
      );
    }

    const dbEventsCount = await this.retryDatabaseEvents(contract, eventName);

    this.logger.log(
      `[${this.handleEvents.name}] Found ${dbEventsCount} failed database event(s) for '${contract.options.address}/${eventName}'`,
    );

    const lastDatabaseBlock = await this.getLastBlockFromDatabase(
      contract.options.address,
      eventName,
    );

    // We don't want to start processing new events until all past events have
    // been synched.
    const { totalCount: pastEventsCount, latestBlockNumber: lastEventBlock } =
      await this.processEvents(contract, eventName, lastDatabaseBlock + 1);

    this.logger.log(
      `[${this.handleEvents.name}] Found ${pastEventsCount} past event(s) for '${contract.options.address}/${eventName}'`,
    );

    this.subscriptions.push({
      contract,
      eventName,
      fromBlock: (lastEventBlock || lastDatabaseBlock) + 1,
    });
  }

  unsubscribe(smartContractAddress: string, eventName: string) {
    const index = this.subscriptions.findIndex(
      (s) =>
        isSameAddress(s.contract.options.address, smartContractAddress) &&
        s.eventName === eventName,
    );

    if (index >= 0) {
      this.subscriptions.splice(index, 1);
      this.logger.log(
        `[${this.handleEvents.name}] Event '${smartContractAddress}/${eventName}' unsubscribed.`,
      );
    } else {
      this.logger.warn(
        `[${this.handleEvents.name}] Event '${smartContractAddress}/${eventName}' not subscribed, skipping.`,
      );
    }
  }
}
