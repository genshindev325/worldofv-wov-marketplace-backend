import { Sale } from '@generated/ts-proto/types/sale';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, Sale as PrismaSale } from '@prisma/client/sale';

@Injectable()
export class SaleService {
  constructor(private readonly prisma: PrismaClient) {}

  prismaSaleToGrpc({ price, startingTime, ...sale }: PrismaSale): Sale {
    // All properties are optional since the request from the client might
    // select only specific fields from the database.
    return {
      ...sale,
      price: price?.toFixed(0),
      startingTime: startingTime?.toISOString(),
    };
  }

  async upsert(
    where: Prisma.SaleWhereUniqueInput,
    data: Prisma.SaleCreateInput,
  ): Promise<PrismaSale> {
    return this.prisma.sale.upsert({
      where,
      update: data,
      create: data,
    });
  }
}
