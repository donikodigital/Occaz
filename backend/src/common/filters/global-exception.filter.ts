// backend/src/common/filters/global-exception.filter.ts
//
// Point d'entrée unique de toutes les exceptions HTTP : applique les filtres existants (HttpExceptionFilter, PrismaExceptionFilter)
// — mêmes réponses qu'avant — et remonte à Sentry les VRAIES erreurs serveur :
//
//   - une exception HTTP de statut >= 500 (service indisponible…) ;
//   - une erreur Prisma non prévue (hors P2002 / P2003 / P2025, qui sont des réponses normales 409 / 400 / 404) ;
//   - toute autre erreur inattendue (bug) → réponse 500 identique à celle de Nest.
//
// Les refus normaux (400 validation, 401, 403, 404, 409, 429…) ne sont JAMAIS envoyés : ils ne sont pas des pannes, et leur
// volume viderait le quota du plan gratuit. Sans SENTRY_DSN, `captureException` ne fait rien.
//
// Un seul filtre global (au lieu de plusieurs) : Nest choisit entre filtres selon leur ordre d'enregistrement ; un filtre
// « attrape-tout » placé à côté des autres pourrait court-circuiter les filtres précis. Ici, l'aiguillage est explicite.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { PrismaExceptionFilter } from './prisma-exception.filter';

/** Codes Prisma traduits en réponses normales par PrismaExceptionFilter : pas des erreurs à remonter. */
const HANDLED_PRISMA_CODES = new Set(['P2002', 'P2003', 'P2025']);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');
  private readonly httpFilter = new HttpExceptionFilter();
  private readonly prismaFilter = new PrismaExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.report(exception, host);
      return;
    }

    if (exception instanceof HttpException) {
      if (exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) this.report(exception, host);
      this.httpFilter.catch(exception, host);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (!HANDLED_PRISMA_CODES.has(exception.code)) this.report(exception, host);
      this.prismaFilter.catch(exception, host);
      return;
    }

    // Erreur inattendue : un bug. Journalisée, remontée, et réponse 500 identique à celle de Nest par défaut.
    this.logger.error(
      exception instanceof Error ? exception.message : 'Erreur inconnue',
      exception instanceof Error ? exception.stack : undefined,
    );
    this.report(exception, host);
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  /**
   * Remonte l'erreur avec de quoi la retrouver : la ROUTE (« /api/v1/bookings/:id », jamais l'URL réelle qui peut contenir des
   * identifiants ou des numéros) et l'identifiant du compte — rien d'autre sur la personne.
   */
  private report(exception: unknown, host: ArgumentsHost): void {
    Sentry.withScope((scope) => {
      if (host.getType() === 'http') {
        const request = host.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
        scope.setTag('route', `${request.method} ${request.route?.path ?? 'non résolue'}`);
        if (request.user?.id) scope.setUser({ id: request.user.id });
      }
      Sentry.captureException(exception);
    });
  }
}
