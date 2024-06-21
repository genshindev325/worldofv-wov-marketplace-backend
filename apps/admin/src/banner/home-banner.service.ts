import {
  CreateHomeBannerArgs,
  UpdateHomeBannerArgs,
} from '@generated/ts-proto/services/admin';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client/admin';

@Injectable()
export class HomeBannerService {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(args?: Prisma.HomeBannerFindManyArgs) {
    return this.prisma.homeBanner.findMany(args);
  }

  async create(args: CreateHomeBannerArgs) {
    return this.prisma.$transaction(async (prisma) => {
      // Make sure we don't have holes between positions.
      const count = await prisma.homeBanner.count();
      args.position = Math.min(args.position, count + 1);

      await prisma.homeBanner.updateMany({
        where: { position: { gte: args.position } },
        data: { position: { increment: 1 } },
      });

      return prisma.homeBanner.create({ data: args });
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (prisma) => {
      const existing = await prisma.homeBanner.findUnique({
        where: { id },
      });

      if (!existing) return null;

      const deleted = await prisma.homeBanner.deleteMany({
        where: { position: existing.position },
      });

      if (deleted.count) {
        await prisma.homeBanner.updateMany({
          where: { position: { gt: existing.position } },
          data: { position: { decrement: 1 } },
        });
      }

      return existing;
    });
  }

  async update(args: UpdateHomeBannerArgs) {
    const existing = await this.delete(args.id);
    if (!existing) return null;
    return this.create({ ...existing, ...args });
  }
}
