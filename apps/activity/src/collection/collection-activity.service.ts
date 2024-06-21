import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GetCollectionActivityArgs } from '@generated/ts-proto/services/activity';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client/blockchain';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { BURN_ADDRESSES_TO_CHECK } from 'common/constants';
import { encodeSerializedJson } from 'common/serialized-json';
import knex from 'knex';
import { lastValueFrom } from 'rxjs';
import Web3 from 'web3';
import { ActivityService } from '../activity.service';

const knexPg = knex({ client: 'pg' });
const toChecksumAddress = Web3.utils.toChecksumAddress;

@Injectable()
export class CollectionActivityService implements OnModuleInit {
  private userService: UserServiceClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly activityService: ActivityService,
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService(USER_SERVICE_NAME);
  }

  async getActivity({
    smartContractAddress,
    page,
    perPage,
    fromDate,
  }: GetCollectionActivityArgs) {
    // JSONPath equality operator is case sensitive so we compare the addresses
    // with both the lowercase and the checksum version.
    // TODO: Find out if all addresses in the DB use either lowercase or checksum format.
    const lowercaseAddress = smartContractAddress.toLowerCase();
    const checksumAddress = toChecksumAddress(smartContractAddress);

    const query = knexPg
      .table('BlockchainEvent')
      .select('*')
      .whereIn('event', [
        'auctionExecuted',
        'OfferAccepted',
        'purchase',
        'purchaseNonCustodial',
      ])
      .andWhere(
        'returnValues',
        '@@',
        `($.nft == "${lowercaseAddress}" || $.nft == "${checksumAddress}") && (!exists($.price) || $.price != "0")`,
      )
      .orderByRaw(`("meta"->'blockNumber')::INT DESC`)
      .orderByRaw(`("meta"->'txID')`)
      .orderByRaw(`("meta"->'clauseIndex')::INT DESC`)
      .offset((page - 1) * perPage)
      .limit(perPage + 1); // We fetch one more item to check if there are more.

    if (fromDate) {
      const timestamp = new Date(fromDate).getTime() / 1000;
      query.where('meta', '@@', `$.blockTimestamp <= ${timestamp}`);
    }

    const response: any[] = await this.prisma.$queryRawUnsafe(query.toString());

    const events = await this.activityService.getActivityFromRawResponse(
      response.slice(0, perPage),
      { includeToken: true },
    );

    return {
      hasMore: response.length > perPage,
      events: events,
    };
  }

  async getRecepientCountForCollection({
    smartContractAddress,
    page,
    perPage,
    fromDate,
  }: GetCollectionActivityArgs) {
    const lowercaseAddress = smartContractAddress.toLowerCase();
    const checksumAddress = toChecksumAddress(smartContractAddress);

    const to = knexPg.raw`("returnValues"->'to')`;

    const query = knexPg
      .table('BlockchainEvent')
      .select(to)
      .count(to)
      // we blacklist burn addresses and the collection contract as well
      // as we don't care about those
      .where((builder) =>
        builder
          .where('returnValues', '@@', `($.to != "${lowercaseAddress}")`)
          .andWhere('returnValues', '@@', `($.to != "${checksumAddress}")`)
          .andWhere((builder) =>
            BURN_ADDRESSES_TO_CHECK.map((burnAdd) =>
              builder.where('returnValues', '@@', `($.to != "${burnAdd}")`),
            ),
          ),
      )
      .andWhere((builder) =>
        builder
          .where('address', lowercaseAddress)
          .orWhere('address', checksumAddress),
      )
      .groupBy(to)
      .orderByRaw(`COUNT(("returnValues"->'to')) DESC`)
      .offset((page - 1) * perPage)
      .limit(perPage + 1); // We fetch one more item to check if there are more.

    if (fromDate) {
      const timestamp = new Date(fromDate).getTime() / 1000;
      query.where('meta', '@@', `$.blockTimestamp >= ${timestamp}`);
    }

    const response: any[] = await this.prisma.$queryRawUnsafe(query.toString());

    const { users } = await lastValueFrom(
      this.userService.findMany(
        encodeSerializedJson<PrismaUser.UserFindManyArgs>({
          where: { address: { in: response.map((r) => r['?column?']) || [] } },
        }),
      ),
    );

    const usersMap = new Map(users?.map((user) => [user.address, user]));

    return {
      hasMore: response.length > perPage,
      users: response.slice(0, perPage).map((r) => ({
        user: usersMap.get(r['?column?']),
        count: Number(r.count),
      })),
    };
  }

  async getLastTransfersForCollection({
    smartContractAddress,
    page,
    perPage,
    fromDate,
  }: GetCollectionActivityArgs) {
    const lowercaseAddress = smartContractAddress.toLowerCase();
    const checksumAddress = toChecksumAddress(smartContractAddress);

    const query = knexPg
      .table('BlockchainEvent')
      .select(
        knexPg.raw(`("returnValues"->'to') AS "to"`),
        knexPg.raw(`("meta" ->> 'blockTimestamp') AS "blockTimestamp"`),
      )
      // we blacklist burn addresses and the collection contract as well
      // as we don't need those
      .where((builder) =>
        builder
          .where('returnValues', '@@', `($.to != "${lowercaseAddress}")`)
          .andWhere('returnValues', '@@', `($.to != "${checksumAddress}")`)
          .andWhere((builder) =>
            BURN_ADDRESSES_TO_CHECK.map((burnAdd) =>
              builder.where('returnValues', '@@', `($.to != "${burnAdd}")`),
            ),
          ),
      )
      .andWhere((builder) =>
        builder
          .where('address', lowercaseAddress)
          .orWhere('address', checksumAddress),
      )
      .orderByRaw(`("meta"->'blockNumber')::INT DESC`)
      .offset((page - 1) * perPage)
      .limit(perPage + 1); // We fetch one more item to check if there are more.

    if (fromDate) {
      const timestamp = new Date(fromDate).getTime() / 1000;
      query.where('meta', '@@', `$.blockTimestamp >= ${timestamp}`);
    }

    const response: any[] = await this.prisma.$queryRawUnsafe(query.toString());

    const { users } = await lastValueFrom(
      this.userService.findMany(
        encodeSerializedJson<PrismaUser.UserFindManyArgs>({
          where: { address: { in: response.map((r) => r['to']) || [] } },
        }),
      ),
    );

    const usersMap = new Map(users?.map((user) => [user.address, user]));

    return {
      hasMore: response.length > perPage,
      users: response.slice(0, perPage).map((r) => ({
        user: usersMap.get(r['to']),
        dateTime: new Date(r['blockTimestamp'] * 1000).toISOString(),
      })),
    };
  }
}
