import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';

@Injectable()
export class JwtStrategy
  extends PassportStrategy(Strategy)
  implements OnModuleInit
{
  private userService: UserServiceClient;

  constructor(
    configService: ConfigService,
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  onModuleInit() {
    this.userService = this.userClient.getService(USER_SERVICE_NAME);
  }

  async validate(payload: any) {
    const user = await lastValueFrom(
      this.userService.findOne({ address: payload.address }).pipe(
        catchError((err) => {
          if (err?.code === GrpcStatus.NOT_FOUND) {
            return of({ address: payload.address });
          } else {
            return throwError(() => err);
          }
        }),
      ),
    );

    return user;
  }
}
