// backend/src/i18n/language.interceptor.ts
// [30/10/2026] v1 — Fixe la langue de la requête (voir language-context.ts). S'exécute après l'authentification : à défaut d'en-tête
// X-App-Language (ou de paramètre ?lang= pour un lien ouvert dans le navigateur, comme un billet PDF), la langue du compte connecté
// est utilisée.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { languageFromRequest } from './language';
import { runWithLanguage } from './language-context';

@Injectable()
export class LanguageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: { language?: string } }>();
    const language = languageFromRequest(request);
    return new Observable((subscriber) => {
      runWithLanguage(language, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
