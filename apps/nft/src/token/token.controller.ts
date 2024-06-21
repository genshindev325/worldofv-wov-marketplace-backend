import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  FindOneTokenArgs,
  GetGenerationRateArgs,
  GetGenesisCountBySetArgs,
  OverrideTokenMetadataArgs,
  SearchTokensByStringArgs,
  TokenExistsArgs,
  TokenServiceController,
  TokenServiceControllerMethods,
  UpsertTokenArgs,
} from '@generated/ts-proto/services/nft';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { Token } from '@generated/ts-proto/types/token';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma, PrismaClient } from '@prisma/client/nft';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { decodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';
import { TokenService } from './token.service';

@Controller()
@TokenServiceControllerMethods()
export class TokenController implements TokenServiceController {
  private readonly logger = new Logger(TokenController.name);

  constructor(
    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceClient: ClientProxy,

    private readonly prisma: PrismaClient,
    private readonly tokenService: TokenService,
  ) {}

  async exists(args: TokenExistsArgs) {
    if (!(args.name || args.tokenId)) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: "Invalid args: either 'tokenId' or 'name' must be supplied.",
      });
    }

    const exists = await this.tokenService.exists(args);
    return { value: exists };
  }

  async count(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.TokenCountArgs>(args);
    const value = await this.prisma.token.count(params);

    return { value };
  }

  async getGenesisCountBySet({ ownerAddress }: GetGenesisCountBySetArgs) {
    const counts = await this.tokenService.getGenesisCountBySet({
      ownerAddress,
    });

    return { counts };
  }

  async getGenerationRate({
    ownerAddress,
    smartContractAddress,
  }: GetGenerationRateArgs) {
    const stakingEarnings = await this.tokenService.getGenerationRateForUser({
      ownerAddress,
      smartContractAddress,
    });

    return { stakingEarnings };
  }

  async findOne(args: FindOneTokenArgs) {
    const token = await this.tokenService.findOne({
      tokenId_smartContractAddress: args,
    });

    if (!token) {
      const paramMessage = Object.entries(args)
        .map(([k, v]) => `"${k}" is "${v}"`)
        .join(' and ');

      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find any Token where ${paramMessage}`,
      });
    }

    return this.tokenService.prismaTokenToGrpc(token);
  }

  async findFirst(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.TokenFindFirstArgs>(args);
    const token = await this.prisma.token.findFirst(params);

    if (!token) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find Token.`,
      });
    }

    return this.tokenService.prismaTokenToGrpc(token);
  }

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.TokenFindUniqueArgs>(args);
    const token = await this.prisma.token.findUnique(params);

    if (!token) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find Token.`,
      });
    }

    return this.tokenService.prismaTokenToGrpc(token);
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.TokenFindManyArgs>(args);
    const tokens = await this.prisma.token.findMany(params);
    return { tokens: tokens.map(this.tokenService.prismaTokenToGrpc) };
  }

  async searchTokensByString(args: SearchTokensByStringArgs) {
    const tokens = await this.tokenService.searchTokensByString(args);

    return { tokens };
  }

  async upsert(args: UpsertTokenArgs) {
    return this.tokenService.upsertToken(args);
  }

  async create(args: Token) {
    const token = await this.tokenService.create(args);

    await lastValueFrom(
      this.marketplaceClient
        .send('UpdateToken', {
          tokenId: token.tokenId,
          smartContractAddress: token.smartContractAddress,
        })
        .pipe(
          catchError((err) => {
            this.logger.error(
              `[${this.create.name}] Error while updating marketplace via Redis`,
              err,
            );
            return of(null);
          }),
        ),
    );

    return token;
  }

  async update(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.TokenUpdateArgs>(args);
    const token = await this.prisma.token.update(params);

    await lastValueFrom(
      this.marketplaceClient.send('UpdateToken', token).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.update.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return this.tokenService.prismaTokenToGrpc(token);
  }

  async delete({ tokenId, smartContractAddress }: FindOneTokenArgs) {
    return this.tokenService.deleteToken(smartContractAddress, tokenId);
  }

  async overrideMetadata(args: OverrideTokenMetadataArgs) {
    return this.tokenService.overrideMetadata(args);
  }
}
