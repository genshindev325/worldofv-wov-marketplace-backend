import { ForbiddenException, Injectable } from '@nestjs/common';
import { GqlAuthGuard } from './gql-auth.guard';

@Injectable()
export class GqlAdminGuard extends GqlAuthGuard {
  async handleRequest(error: any, user: any) {
    if (error) throw error;

    if (!user?.isAdmin) {
      throw new ForbiddenException(`Current user is not an administrator.`);
    }

    return user;
  }
}
