// backend/src/common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { languageFromRequest } from '../../i18n/language';
import { translateMessage } from '../../i18n/server-text';

/**
 * Format d'erreur unique pour toute l'API — le frontend n'a qu'une seule
 * forme d'erreur à gérer, quelle que soit son origine.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    // Le message est écrit en français dans tout le code : il est traduit ici, une seule fois, dans la langue de l'application.
    const message = translateMessage(
      typeof body === 'string'
        ? body
        : ((body as Record<string, unknown>).message ?? exception.message),
      languageFromRequest(request),
    );

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
