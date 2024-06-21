import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  EditionServiceController,
  EditionServiceControllerMethods,
  FindOneEditionArgs,
} from '@generated/ts-proto/services/nft';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Edition, Prisma, PrismaClient } from '@prisma/client/nft';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { decodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';

@Controller()
@EditionServiceControllerMethods()
export class EditionController implements EditionServiceController {
  private readonly logger = new Logger(EditionController.name);

  constructor(
    @Inject(REDIS_CLIENT_PROXY)
    private readonly client: ClientProxy,

    public readonly prisma: PrismaClient,
  ) {}

  async findOne(args: SerializedJson): Promise<Edition> {
    const params = decodeSerializedJson<Prisma.EditionFindUniqueArgs>(args);
    const edition = await this.prisma.edition.findUnique(params);

    if (!edition) {
      const paramMessage = Object.entries(params)
        .map(([k, v]) => `"${k}" is "${v}"`)
        .join(' and ');

      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find any Edition where ${paramMessage}`,
      });
    }

    return edition;
  }

  async findMany(args: SerializedJson): Promise<{ editions: Edition[] }> {
    const params = decodeSerializedJson<Prisma.EditionFindManyArgs>(args);
    const editions = await this.prisma.edition.findMany(params);

    return { editions };
  }

  async exists(args: FindOneEditionArgs): Promise<{ value: boolean }> {
    const edition = await this.prisma.edition.findUnique({
      select: null,
      where: {
        editionId_smartContractAddress: {
          editionId: args.editionId,
          smartContractAddress: args.smartContractAddress,
        },
      },
    });

    return { value: !!edition };
  }

  async count(args: SerializedJson): Promise<{ value: number }> {
    const params = decodeSerializedJson<Prisma.EditionCountArgs>(args);
    const value = await this.prisma.edition.count(params);

    return { value };
  }

  async upsert(args: SerializedJson): Promise<Edition> {
    const params = decodeSerializedJson<Prisma.EditionUpsertArgs>(args);

    let edition;

    try {
      edition = await this.prisma.edition.upsert(params);
    } catch (error) {
      // If is not a Prisma "Unique constraint error" throw the error
      if (error?.code != 'P2002') {
        throw error;
      }
    }

    if (edition) {
      await lastValueFrom(
        this.client.send('UpdateToken', edition).pipe(
          catchError((err) => {
            this.logger.error(
              `[${this.upsert.name}] Error while updating marketplace via Redis`,
              err,
            );

            return of(null);
          }),
        ),
      );
    }

    return edition;
  }

  async update(args: SerializedJson): Promise<Edition> {
    const params = decodeSerializedJson<Prisma.EditionUpdateArgs>(args);

    const edition = await this.prisma.edition.update(params);

    if (!edition) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: 'Edition not found',
      });
    }

    await lastValueFrom(
      this.client.send('UpdateToken', edition).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.update.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return edition;
  }

  async delete({
    editionId,
    smartContractAddress,
  }: FindOneEditionArgs): Promise<{ deleted: boolean }> {
    // Make sure we don't delete everything by mistake.
    if (!editionId || !smartContractAddress) {
      throw new Error(`[${this.delete.name}] Wrong argument format`);
    }

    const edition = await this.prisma.edition.findUnique({
      select: { tokenId: true },
      rejectOnNotFound: false,
      where: {
        editionId_smartContractAddress: { editionId, smartContractAddress },
      },
    });

    if (!edition) return { deleted: false };

    const tokenId = edition.tokenId;

    const editionsCount = await this.prisma.edition.count({
      where: { tokenId, smartContractAddress },
    });

    // Delete both the edition and the token if there are no more editions left.
    if (editionsCount <= 1) {
      await this.prisma.token.delete({
        where: {
          tokenId_smartContractAddress: { tokenId, smartContractAddress },
        },
      });

      await lastValueFrom(
        this.client.send('DeleteToken', { tokenId, smartContractAddress }).pipe(
          catchError((err) => {
            this.logger.error(
              `[${this.delete.name}] Error while updating marketplace via Redis`,
              err,
            );
            return of(null);
          }),
        ),
      );
    } else {
      await this.prisma.$transaction([
        this.prisma.token.update({
          where: {
            tokenId_smartContractAddress: { tokenId, smartContractAddress },
          },
          data: { editionsCount: editionsCount - 1 },
        }),
        this.prisma.edition.delete({
          where: {
            editionId_smartContractAddress: { editionId, smartContractAddress },
          },
        }),
      ]);

      await lastValueFrom(
        this.client.send('UpdateToken', { tokenId, smartContractAddress }).pipe(
          catchError((err) => {
            this.logger.error(
              `[${this.delete.name}] Error while updating marketplace via Redis`,
              err,
            );
            return of(null);
          }),
        ),
      );
    }

    return { deleted: true };
  }
}
