import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientGrpc } from '@nestjs/microservices';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import { Certificate } from 'thor-devkit';
import Web3 from 'web3';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private userService: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService(USER_SERVICE_NAME);
  }

  /**
   * Validate the frontend certificate and throw an exception if invalid.
   */
  async validateCertificate(args: CertificateData) {
    // Create the certificate mirroring the frontend data.
    const message: Certificate = {
      purpose: 'identification',
      payload: {
        type: 'text',
        content:
          'Please select a wallet and grant access to the World of V marketplace',
      },
      ...args.annex,
      signature: args.signature,
    };

    try {
      Certificate.verify(message);
    } catch (err) {
      throw new ExtendedRpcException({
        code: GrpcStatus.PERMISSION_DENIED,
        message: 'Invalid login certificate.',
      });
    }
  }

  /**
   * Validate the frontend certificate to login and return the user data.
   */
  async login(args: CertificateData) {
    await this.validateCertificate(args);

    const address = Web3.utils.toChecksumAddress(args.annex.signer);
    const jwt = this.jwtService.sign({ address });

    const user = await lastValueFrom(
      this.userService.findOne({ address }).pipe(
        catchError((err) => {
          if (err?.code === GrpcStatus.NOT_FOUND) {
            return of({ address });
          } else {
            return throwError(() => err);
          }
        }),
      ),
    );

    return { jwt, user };
  }
}
