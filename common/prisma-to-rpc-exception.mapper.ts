import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import ExtendedRpcException from './extended-rpc-exception';

const PRISMA_CODE_TO_RPC_STATUS: Record<string, GrpcStatus> = {
  P2000: GrpcStatus.INVALID_ARGUMENT,
  P2001: GrpcStatus.NOT_FOUND,
  P2002: GrpcStatus.ALREADY_EXISTS,
  P2003: GrpcStatus.INTERNAL,
  P2004: GrpcStatus.INTERNAL,
  P2005: GrpcStatus.INVALID_ARGUMENT,
  P2006: GrpcStatus.INVALID_ARGUMENT,
  P2007: GrpcStatus.INTERNAL,
  P2008: GrpcStatus.INVALID_ARGUMENT,
  P2009: GrpcStatus.INTERNAL,
  P2010: GrpcStatus.INVALID_ARGUMENT,
  P2011: GrpcStatus.INVALID_ARGUMENT,
  P2012: GrpcStatus.INVALID_ARGUMENT,
  P2013: GrpcStatus.INVALID_ARGUMENT,
  P2014: GrpcStatus.INVALID_ARGUMENT,
  P2015: GrpcStatus.NOT_FOUND,
  P2016: GrpcStatus.INTERNAL,
  P2017: GrpcStatus.INVALID_ARGUMENT,
  P2018: GrpcStatus.NOT_FOUND,
  P2019: GrpcStatus.INVALID_ARGUMENT,
  P2020: GrpcStatus.INVALID_ARGUMENT,
  P2021: GrpcStatus.NOT_FOUND,
  P2022: GrpcStatus.NOT_FOUND,
  P2023: GrpcStatus.INVALID_ARGUMENT,
  P2024: GrpcStatus.INTERNAL,
  P2025: GrpcStatus.NOT_FOUND,
  P2026: GrpcStatus.INTERNAL,
  P2027: GrpcStatus.INTERNAL,
  P2028: GrpcStatus.INVALID_ARGUMENT,
  P2030: GrpcStatus.INTERNAL,
  P2031: GrpcStatus.INTERNAL,
  P2033: GrpcStatus.INVALID_ARGUMENT,
  P2034: GrpcStatus.INTERNAL,
};

@Injectable()
export class PrismaToRpcExceptionMapper implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // We can't perform the check using the `instanceof` operator since
        // each client uses a different class.
        if (typeof error?.code === 'string' && error.code.match(/^P\d{4}$/)) {
          const exc = new ExtendedRpcException({
            code: PRISMA_CODE_TO_RPC_STATUS[error.code] || GrpcStatus.INTERNAL,
            message: error.message,
          });

          return throwError(() => exc);
        } else {
          return throwError(() => error);
        }
      }),
    );
  }
}
