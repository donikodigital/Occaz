// backend/src/common/filters/prisma-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Traduit les erreurs Prisma connues en réponses HTTP propres, pour ne
 * jamais laisser fuiter un message d'erreur SQL brut au client.
 *   P2002 — violation de contrainte unique
 *   P2003 — violation de clé étrangère
 *   P2025 — enregistrement non trouvé
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Une erreur interne est survenue.";

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | undefined)?.join(', ');
        message = `Une ressource avec ce ${target ?? 'champ'} existe déjà.`;
        break;
      }
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = "Référence invalide : la ressource liée n'existe pas.";
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Ressource introuvable.';
        break;
      default:
        this.logger.error(`Erreur Prisma non gérée [${exception.code}]`, exception.stack);
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
