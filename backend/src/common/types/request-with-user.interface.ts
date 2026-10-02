// backend/src/common/types/request-with-user.interface.ts
import { AccountType } from '@prisma/client';
import { Request } from 'express';

/**
 * Forme de l'utilisateur posée sur `request.user` par JwtAuthGuard.
 * Volontairement minimale — le profil complet (Customer/Driver) se charge
 * à la demande dans les services qui en ont besoin, pour ne pas alourdir
 * chaque requête authentifiée d'une jointure inutile.
 */
export interface AuthenticatedUser {
  id: string;
  phone: string;
  accountType: AccountType;
  sessionId: string;
  /** Permissions effectives résolues à partir des UserRole (voir PermissionsGuard). */
  permissions: string[];
  /** Pays de portée pour les rôles Support scopés géographiquement (peut être vide = accès global). */
  scopedCountryIds: string[];
  /**
   * Portée par permission : pour chaque permission accordée uniquement par des rôles limités à un pays, la
   * liste de ces pays. Une permission absente est valable partout. Voir common/scope/country-scope.ts.
   */
  countryScopes: Record<string, string[]>;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}