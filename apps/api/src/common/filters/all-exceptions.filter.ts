import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

interface ErrorBody {
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  };
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

/**
 * Single place that turns any thrown error into the API's error envelope.
 * Unknown errors are logged server-side and reported to clients generically,
 * so stack traces, SQL and secrets never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.error.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: unknown;
      if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        if (Array.isArray(r.message)) {
          message = 'Validation failed';
          details = r.message;
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
        if (r.details !== undefined) details = r.details;
      }
      const code =
        (typeof response === 'object' && response && typeof (response as { code?: unknown }).code === 'string'
          ? (response as { code: string }).code
          : undefined) ??
        STATUS_CODES[status] ??
        'ERROR';
      return { error: { statusCode: status, code, message, ...(details !== undefined ? { details } : {}) } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          error: { statusCode: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'A record with these values already exists' },
        };
      }
      if (exception.code === 'P2025') {
        return { error: { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Record not found' } };
      }
      if (exception.code === 'P2003') {
        return {
          error: { statusCode: HttpStatus.BAD_REQUEST, code: 'BAD_REQUEST', message: 'Related record does not exist' },
        };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    return {
      error: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    };
  }
}
