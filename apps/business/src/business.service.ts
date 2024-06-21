import {
  CheckSecretCodeArgs as ProtoCheckSecretCodeArgs,
  ConsumeSecretCodeArgs as ProtoConsumeSecretCodeArgs,
  CreateClientArgs,
} from '@generated/ts-proto/services/business';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/business';
import ExtendedRpcException from 'common/extended-rpc-exception';

type CheckSecretCodeArgs = ProtoCheckSecretCodeArgs & {
  prisma?: Parameters<Parameters<PrismaClient['$transaction']>['0']>['0'];
};

type ConsumeSecretCodeArgs = Omit<ProtoConsumeSecretCodeArgs, 'metadata'> & {
  metadata: any;
};

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaClient) {}

  async createClient({ secretCodes, ...data }: CreateClientArgs) {
    try {
      await this.prisma.client.create({
        data: {
          ...data,
          secretCodes: {
            createMany: { data: secretCodes.map((value) => ({ value })) },
          },
        },
      });
    } catch (error) {
      if (
        typeof error?.code === 'string' &&
        error.code === 'P2002' /* unique constraint failed */
      ) {
        throw new ExtendedRpcException({
          code: GrpcStatus.ALREADY_EXISTS,
          message: `Client '${data.id}' already exists.`,
        });
      } else {
        throw error;
      }
    }
  }

  async checkSecretCode({
    clientId,
    secretCode: secretCodeValue,
    claimerAddress,
    prisma = this.prisma,
  }: CheckSecretCodeArgs) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { secretCodes: { where: { value: secretCodeValue } } },
    });

    if (!client) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Client '${clientId}' not found.`,
      });
    }

    if (!client.secretCodes?.length) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Secret code not found.`,
      });
    }

    if (client.uniqueClaimer) {
      const claimCount = await prisma.claim.count({
        where: { clientId, claimerAddress },
      });

      if (claimCount) {
        throw new ExtendedRpcException({
          code: GrpcStatus.FAILED_PRECONDITION,
          message: `User '${claimerAddress}' has already performed a claim.`,
        });
      }
    }

    if (client.disposableCodes) {
      const claimCount = await prisma.claim.count({
        where: { clientId, secretCodeValue },
      });

      if (claimCount) {
        throw new ExtendedRpcException({
          code: GrpcStatus.RESOURCE_EXHAUSTED,
          message: `Code was already used to perform a claim.`,
        });
      }
    }
  }

  async consumeSecretCode({
    clientId,
    secretCode,
    claimerAddress,
    metadata,
  }: ConsumeSecretCodeArgs) {
    // We perform the checks inside a transaction to eliminate the possibility
    // of being able to perform a claim twice in case multiple requests for the
    // same secret code are handled concurrently.
    // See https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ

    await this.prisma.$transaction(
      async (prisma) => {
        await this.checkSecretCode({
          clientId,
          secretCode,
          claimerAddress,
          prisma,
        });

        await prisma.claim.create({
          data: {
            claimerAddress,
            metadata,
            client: { connect: { id: clientId } },
            secretCode: {
              connect: { clientId_value: { clientId, value: secretCode } },
            },
          },
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
