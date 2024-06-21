import { Catch, ExceptionFilter } from '@nestjs/common';
import { GoogleRecaptchaException } from '@nestlab/google-recaptcha';
import { GraphQLError } from 'graphql';

@Catch(GoogleRecaptchaException)
export class GoogleRecaptchaExceptionFilter implements ExceptionFilter {
  catch(exception: GoogleRecaptchaException) {
    const code = exception.errorCodes?.[0]?.replace(/-/g, '_')?.toUpperCase();

    return new GraphQLError(exception.message, {
      extensions: {
        code: 'RECAPTCHA_' + code,
      },
    });
  }
}
