import {
  DeleteVerifiedDropArgs,
  UpsertVerifiedDropArgs,
  VerifiedDropServiceController,
  VerifiedDropServiceControllerMethods,
} from '@generated/ts-proto/services/admin';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { VerifiedDropService } from './verified-drop.service';

@Controller()
@VerifiedDropServiceControllerMethods()
export class VerifiedDropController implements VerifiedDropServiceController {
  constructor(private readonly verifiedDropService: VerifiedDropService) {}

  async getAll() {
    const drops = await this.verifiedDropService.findMany({
      orderBy: { position: 'asc' },
    });

    return { drops };
  }

  async upsert(args: UpsertVerifiedDropArgs) {
    if (!args.collectionId && !args.tokenId && !args.title) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: `Input must contain either collectionId, tokenId, or (title, imageUrl, address).`,
      });
    }

    if (args.tokenId && args.collectionId) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: `Arguments tokenId and collectionId are mutually exclusive.`,
      });
    }

    if (
      (args.tokenId || args.collectionId) &&
      (args.title || args.imageUrl || args.address)
    ) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: `Managed drops must not define title, imageUrl or address.`,
      });
    }

    if (
      (args.title || args.imageUrl || args.address) &&
      (!args.title || !args.imageUrl || !args.address)
    ) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: `Unmanaged drops must contain title, imageUrl, and address.`,
      });
    }

    if (args.tokenId) {
      const exists = await this.verifiedDropService.tokenExists(args.tokenId);

      if (!exists) {
        throw new ExtendedRpcException({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: `Couldn't find token "${args.tokenId}"`,
        });
      }
    }

    if (args.collectionId) {
      const exists = await this.verifiedDropService.collectionExists(
        args.collectionId,
      );

      if (!exists) {
        throw new ExtendedRpcException({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: `Couldn't find collection "${args.collectionId}"`,
        });
      }
    }

    const drop = await this.verifiedDropService.upsert(args);

    if (!drop) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find drop "${args.id}"`,
      });
    }

    return drop;
  }

  async delete(args: DeleteVerifiedDropArgs) {
    const deleted = await this.verifiedDropService.delete(args.id);
    return { value: !!deleted };
  }
}
