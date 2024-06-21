import { status as GrpcStatus } from '@grpc/grpc-js';
import { Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { GraphQLError } from 'graphql';

@Catch(ExtendedRpcException)
export class ExtendedRpcExceptionFilter implements GqlExceptionFilter {
  catch(exc: ExtendedRpcException) {
    return new GraphQLError(exc.message, {
      extensions: {
        code: Object.entries(GrpcStatus).find(([_, v]) => v === exc.code)[0],
      },
    });
  }
}
