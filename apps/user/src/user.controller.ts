import {
  FindUserArgs,
  SearchUsersByStringArgs,
  UpdateUserArgs,
  UpsertUserArgs,
  UserServiceController,
  UserServiceControllerMethods,
} from '@generated/ts-proto/services/user';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { User } from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, UseInterceptors } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client/user';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { PrismaToRpcExceptionMapper } from 'common/prisma-to-rpc-exception.mapper';
import { decodeSerializedJson } from 'common/serialized-json';
import { UserService } from './user.service';

@Controller()
@UserServiceControllerMethods()
@UseInterceptors(new PrismaToRpcExceptionMapper())
export class UserController implements UserServiceController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  async findOne(args: FindUserArgs) {
    if (Object.values(args).length > 1) {
      throw new ExtendedRpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: 'You provided more than one argument to UserService.findOne.',
      });
    }

    const user = await this.userService.findOne(args);

    if (!user) {
      const [k, v] = Object.entries(args)[0];

      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find any User where "${k}" is "${v}"`,
      });
    }

    return user as User;
  }

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.UserFindUniqueArgs>(args);
    const user = await this.prisma.user.findUnique(params);

    if (!user) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `User '${params.where.address}' does not exist.`,
      });
    }

    return user as User;
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.UserFindManyArgs>(args);
    const users = await this.prisma.user.findMany(params);

    return { users: users as User[] };
  }

  async searchUsersByString(args: SearchUsersByStringArgs) {
    const users = await this.userService.searchUsersByString(args);
    return { users: users as User[] };
  }

  async upsert(args: UpsertUserArgs) {
    const user = await this.userService.upsert(args);
    return user as User;
  }

  async update(args: UpdateUserArgs) {
    const user = await this.userService.update(args);
    return user as User;
  }
}
