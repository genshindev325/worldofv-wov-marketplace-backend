import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  AuthServiceClient,
  AUTH_SERVICE_NAME,
} from '@generated/ts-proto/services/auth';
import { Inject, OnModuleInit } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { LoginResponse } from './login.response';
import { ValidateCertificateArgs } from './validate-certificate.args';

@Resolver()
export class AuthResolver implements OnModuleInit {
  private authService: AuthServiceClient;

  constructor(
    @Inject(GrpcClientKind.AUTH)
    private readonly authClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService(AUTH_SERVICE_NAME);
  }

  @Mutation(() => LoginResponse)
  async login(@Args() args: ValidateCertificateArgs) {
    return await lastValueFrom(this.authService.login(args));
  }
}
