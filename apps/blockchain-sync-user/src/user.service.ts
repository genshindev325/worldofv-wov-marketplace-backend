import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  UpsertUserArgs,
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ThorifyContract } from 'thorify';

@Injectable()
export class UserService implements OnModuleInit {
  protected readonly logger = new Logger(UserService.name);

  public userContract: ThorifyContract;
  public grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
    private readonly contractService: ContractService,
  ) {}

  async onModuleInit() {
    this.userContract = this.contractService.getContract(
      process.env.WOV_MARKETPLACE_ACCOUNT_ADDRESS,
      'wov-user',
    );

    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  public async fetchAccountInfo(address: string): Promise<UpsertUserArgs> {
    const accountProperties = await this.userContract.methods
      .getAccountPropertiesByAddress(address)
      .call();

    return {
      profileId: Number(accountProperties[0]),
      address,
      name: accountProperties[4],
    };
  }
}
