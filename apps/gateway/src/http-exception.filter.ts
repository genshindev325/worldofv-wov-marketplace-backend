import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

@Catch(HttpException)
export class HttpExceptionFilter implements GqlExceptionFilter {
  catch(exc: HttpException) {
    const status = exc.getStatus();

    return new GraphQLError(exc.message, {
      extensions: {
        code: Object.entries(HttpStatus).find(([_, v]) => v === status)[0],
      },
    });
  }
}
