import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

interface JsonResponse {
  status(code: number): this;
  json(body: unknown): void;
}

/**
 * Domain errors already reach here as a well-formed HttpException (see
 * http-error.mapper.ts) — those are expected outcomes, not bugs, so they're just
 * passed through untouched. Anything else means something actually broke; that's
 * the only case reported to Sentry, with a generic 500 body (never a raw
 * exception/stack trace to the client — same rule as GATEWAY_ERROR).
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    Sentry.captureException(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      details: null,
    });
  }
}
