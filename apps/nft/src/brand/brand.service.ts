import { UpsertBrandArgs } from '@generated/ts-proto/services/nft';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/nft';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAll() {
    return this.prisma.brand.findMany({ orderBy: { position: 'asc' } });
  }

  async upsert(args: UpsertBrandArgs) {
    await this.delete(args.id);

    return this.prisma.$transaction(async (prisma) => {
      const count = await prisma.brand.count();
      const position = Math.min(args.position || 1, count + 1);

      await prisma.brand.updateMany({
        where: { position: { gte: position } },
        data: { position: { increment: 1 } },
      });

      return prisma.brand.create({ data: { ...args, position } });
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (prisma) => {
      const existing = await prisma.brand.findUnique({
        where: { id },
      });

      if (!existing) return;

      const deleted = await prisma.brand.deleteMany({
        where: { position: existing.position },
      });

      if (deleted.count) {
        await prisma.brand.updateMany({
          where: { position: { gt: existing.position } },
          data: { position: { decrement: 1 } },
        });
      }
    });
  }
}
