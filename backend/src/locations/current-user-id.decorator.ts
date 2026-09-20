// backend/src/locations/current-user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Renvoie l'identifiant de l'utilisateur authentifié — celui que la
 * stratégie JWT pose sur `request.user` (clé `id`, `userId` ou `sub`).
 *
 * Volontairement tolérant : si l'identifiant est introuvable, on renvoie
 * `undefined` au lieu de lever une erreur. La mémoire d'adresses est alors
 * simplement désactivée pour cette requête, sans jamais bloquer la
 * création d'un trajet ou d'un envoi.
 *
 * Si ton projet a déjà un décorateur `@CurrentUser()`, tu peux l'utiliser
 * à la place dans LocationsController et supprimer ce fichier.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: Record<string, unknown> }>();
    const user = request.user;
    if (!user) return undefined;
    const id = user.id ?? user.userId ?? user.sub;
    return typeof id === 'string' ? id : undefined;
  },
);