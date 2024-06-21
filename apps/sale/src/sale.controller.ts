import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  SaleServiceController,
  SaleServiceControllerMethods,
} from '@generated/ts-proto/services/sale';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma, PrismaClient } from '@prisma/client/sale';
import BigNumber from 'bignumber.js';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { decodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';
import { SaleService } from './sale.service';

@Controller()
@SaleServiceControllerMethods()
export class SaleController implements SaleServiceController {
  private readonly logger = new Logger(SaleController.name);

  constructor(
    @Inject(REDIS_CLIENT_PROXY) private readonly client: ClientProxy,
    private readonly prisma: PrismaClient,
    private readonly saleService: SaleService,
  ) {}

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.SaleFindUniqueArgs>(args);
    const sale = await this.prisma.sale.findUnique(params);

    if (!sale) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find sale."`,
      });
    }

    return this.saleService.prismaSaleToGrpc(sale);
  }

  async findFirst(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.SaleFindFirstArgs>(args);
    const sale = await this.prisma.sale.findFirst(params);

    if (!sale) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find sale."`,
      });
    }

    return this.saleService.prismaSaleToGrpc(sale);
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.SaleFindManyArgs>(args);
    const sales = await this.prisma.sale.findMany(params);
    return { sales: sales.map(this.saleService.prismaSaleToGrpc) };
  }

  async count(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.SaleCountArgs>(args);
    const value = await this.prisma.sale.count(params);
    return { value };
  }

  async upsert(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.SaleUpsertArgs>(args);

    // TODO: fix: there is a bug in the prisma engine where numbers bigger
    // than 2 ^ 128 - 1 cause the engine to crash

    const limit = new BigNumber(2).pow(128).minus(1);

    if (
      (params.create?.price &&
        new BigNumber(params.create.price.toString()).gte(limit)) ||
      (params.update?.price &&
        new BigNumber(params.update.price.toString()).gte(limit))
    ) {
      const value = limit.toFormat({ groupSeparator: '' });

      params.create.price = value;
      params.update.price = value;
    }

    const sale = await this.prisma.sale.upsert(params);

    await lastValueFrom(
      this.client.send('UpdateSale', { saleId: sale.saleId }).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.upsert.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return this.saleService.prismaSaleToGrpc(sale);
  }
}
