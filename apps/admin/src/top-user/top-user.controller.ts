import {
  DeleteTopUserArgs,
  GetAllTopUsersArgs,
  TopUserServiceController,
  TopUserServiceControllerMethods,
  UpsertTopUserArgs,
} from '@generated/ts-proto/services/admin';
import { Controller } from '@nestjs/common';
import { TopUserService } from './top-user.service';

@Controller()
@TopUserServiceControllerMethods()
export class TopUserController implements TopUserServiceController {
  constructor(private readonly topUserService: TopUserService) {}

  async getAll({ kind }: GetAllTopUsersArgs) {
    const users = await this.topUserService.findMany(kind, {
      orderBy: [{ position: 'asc' }],
    });

    return { users };
  }

  async upsert(args: UpsertTopUserArgs) {
    return this.topUserService.upsert(args);
  }

  async delete({ kind, address }: DeleteTopUserArgs) {
    const deleted = await this.topUserService.delete(kind, address);
    return { value: !!deleted };
  }
}
