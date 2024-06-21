import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  TopUserKind,
  UpsertTopUserArgs,
} from '@generated/ts-proto/services/admin';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { User } from '@generated/ts-proto/types/user';
import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma, PrismaClient } from '@prisma/client/admin';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';
import Web3 from 'web3';

@Injectable()
export class TopUserService {
  private grpcUser: UserServiceClient;

  private tables = {
    [TopUserKind.TOP_ARTIST]: 'topArtist' as const,
    [TopUserKind.TOP_COLLECTOR]: 'topCollector' as const,
  };

  constructor(
    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    private readonly prisma: PrismaClient,
  ) {}

  onModuleInit() {
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  async findMany(
    kind: TopUserKind,
    args: Prisma.TopArtistFindManyArgs & Prisma.TopCollectorFindManyArgs,
  ) {
    const table = this.tables[kind];
    const items = await this.prisma[table].findMany(args);

    const { users } = await lastValueFrom(
      this.grpcUser.findMany(
        encodeSerializedJson<PrismaUser.UserFindManyArgs>({
          where: { address: { in: items.map((u) => u.address) || [] } },
        }),
      ),
    );

    const usersByAddress = users?.reduce(
      (byId, user) =>
        byId.set(Web3.utils.toChecksumAddress(user.address), user),
      new Map<string, User>(),
    );

    return items?.map((u) => ({
      ...u,
      kind,
      user: usersByAddress?.get(Web3.utils.toChecksumAddress(u.address)),
    }));
  }

  async upsert({ kind, ...args }: UpsertTopUserArgs) {
    await this.delete(kind, args.address);

    return this.prisma.$transaction(async (prisma) => {
      const table = this.tables[kind];

      // Make sure we don't have holes between positions.
      const count = await prisma[table].count();
      args.position = Math.min(args.position, count + 1);

      await prisma[table].updateMany({
        where: { position: { gte: args.position } },
        data: { position: { increment: 1 } },
      });

      const created = await prisma[table].create({ data: args });
      return { ...created, kind };
    });
  }

  async delete(kind: TopUserKind, address: string) {
    return this.prisma.$transaction(async (prisma) => {
      const table = this.tables[kind];

      const existing = await prisma[table].findUnique({
        where: { address },
      });
      if (!existing) return null;

      const deleted = await prisma[table].deleteMany({
        where: { position: existing.position },
      });

      if (deleted.count) {
        await prisma[table].updateMany({
          where: { position: { gt: existing.position } },
          data: { position: { decrement: 1 } },
        });
      }

      return { ...existing, kind };
    });
  }
}
