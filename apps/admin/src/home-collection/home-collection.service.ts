import { HomeCollection } from '@generated/ts-proto/services/admin';
import { Injectable } from '@nestjs/common';
import {
  HomeCollection as PrismaCollection,
  Prisma as PrismaAdmin,
  PrismaClient,
} from '@prisma/client/admin';

@Injectable()
export class HomeCollectionService {
  constructor(private readonly prisma: PrismaClient) {}

  private static prismaCollectionToDto(
    collection: PrismaCollection,
  ): HomeCollection {
    return {
      ...collection,
      startsAt: collection.startsAt.toISOString(),
      avatarVerifiedLevel: collection.avatarVerifiedLevel,
    };
  }

  async findMany(args: PrismaAdmin.HomeCollectionFindManyArgs) {
    const collections = await this.prisma.homeCollection.findMany(args);

    return collections.map(HomeCollectionService.prismaCollectionToDto);
  }

  async upsert(args: PrismaAdmin.HomeCollectionCreateInput) {
    if (args.id) {
      const existing = await this.delete(args.id);
      if (!existing) return null;
    }

    return this.prisma.$transaction(async (prisma) => {
      // Make sure we don't have holes between positions.
      const count = await prisma.homeCollection.count();
      args.position = Math.min(args.position, count + 1);

      await prisma.homeCollection.updateMany({
        where: { position: { gte: args.position } },
        data: { position: { increment: 1 } },
      });

      const created = await prisma.homeCollection.create({ data: args });

      return HomeCollectionService.prismaCollectionToDto(created);
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (prisma) => {
      const existing = await prisma.homeCollection.findUnique({
        where: { id },
      });

      if (!existing) return null;

      const deleted = await prisma.homeCollection.deleteMany({
        where: { position: existing.position },
      });

      if (deleted.count) {
        await prisma.homeCollection.updateMany({
          where: { position: { gt: existing.position } },
          data: { position: { decrement: 1 } },
        });
      }

      return HomeCollectionService.prismaCollectionToDto(existing);
    });
  }
}
