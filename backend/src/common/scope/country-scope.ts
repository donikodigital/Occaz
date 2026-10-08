// backend/src/common/scope/country-scope.ts
//
// Portée géographique des rôles (recommandation Partie II : « un agent support peut être limité aux
// litiges de son pays »). Une attribution de rôle (UserRole) peut porter un pays ; ce fichier décide
// ce que cela change, sans toucher à la base :
//
//  1. resolveEffectivePermissions() — pour chaque permission, est-elle accordée partout (au moins un rôle
//     sans pays) ou seulement pour une liste de pays ? Les permissions de configuration de la plateforme
//     (rôles, paramètres, finance globale…) n'ont pas de sens « par pays » : accordées uniquement via un
//     rôle limité à un pays, elles sont ignorées plutôt que de s'ouvrir à toute la plateforme.
//  2. scopeOf() — la portée d'un utilisateur pour une permission : null = aucune restriction.
//  3. Les filtres Prisma (`…ScopeWhere`) qui disent « ce dossier relève de ces pays ».
//
// Règle d'appartenance, volontairement inclusive : un dossier relève d'un pays dès que l'une de ses parties
// (conducteur, client) y est rattachée, ou que son trajet / ses adresses y passent. Un agent de Guinée voit
// donc un trajet Conakry → Dakar, mais jamais un dossier dont aucun élément ne touche la Guinée.
import { AccountType, Prisma } from '@prisma/client';
import { PERMISSIONS, PermissionKey } from '../constants/permissions.constants';

/** null = aucune restriction géographique ; sinon la liste (jamais vide) des pays autorisés. */
export type CountryScope = string[] | null;

/**
 * Permissions qui portent sur la plateforme entière (configuration, finance globale, contenus, rôles…) :
 * aucun filtre par pays n'est possible dessus. Elles ne sont effectives que si un rôle SANS pays les accorde.
 */
export const GLOBAL_ONLY_PERMISSIONS: ReadonlySet<string> = new Set<string>([
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.SETTINGS_UPDATE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.DASHBOARD_ADMIN_READ,
  PERMISSIONS.GEOGRAPHY_MANAGE,
  PERMISSIONS.SHIPMENT_CATEGORY_MANAGE,
  PERMISSIONS.PAYMENT_PROVIDER_MANAGE,
  PERMISSIONS.COMMISSION_MANAGE,
  PERMISSIONS.PROMOTION_MANAGE,
  PERMISSIONS.CANCELLATION_POLICY_MANAGE,
  PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE,
  // L'argent de la plateforme n'est pas rattaché à un pays : jamais de portée par pays.
  PERMISSIONS.PLATFORM_WALLET_READ,
  PERMISSIONS.PLATFORM_WALLET_MANAGE,
]);

export interface RoleGrant {
  /** Pays de l'attribution (UserRole.countryId) ; null = rôle valable partout. */
  countryId: string | null;
  permissionKeys: string[];
}

export interface EffectivePermissions {
  /** Permissions effectives (union de tous les rôles, hors permissions globales accordées seulement par pays). */
  permissions: string[];
  /** Union de tous les pays des attributions limitées (conservé tel quel pour compatibilité). */
  scopedCountryIds: string[];
  /**
   * Pour chaque permission accordée UNIQUEMENT par des rôles limités à un pays : la liste de ces pays.
   * Une permission absente de cette table est accordée partout.
   */
  countryScopes: Record<string, string[]>;
}

export function resolveEffectivePermissions(grants: RoleGrant[]): EffectivePermissions {
  const globalGrants = new Set<string>();
  const scopedGrants = new Map<string, Set<string>>();
  const allScopedCountries = new Set<string>();

  for (const grant of grants) {
    if (grant.countryId) allScopedCountries.add(grant.countryId);

    for (const key of grant.permissionKeys) {
      if (!grant.countryId) {
        globalGrants.add(key);
        continue;
      }
      if (GLOBAL_ONLY_PERMISSIONS.has(key)) continue;
      const countries = scopedGrants.get(key) ?? new Set<string>();
      countries.add(grant.countryId);
      scopedGrants.set(key, countries);
    }
  }

  const permissions = new Set<string>(globalGrants);
  const countryScopes: Record<string, string[]> = {};
  for (const [key, countries] of scopedGrants) {
    permissions.add(key);
    if (!globalGrants.has(key)) countryScopes[key] = Array.from(countries);
  }

  return {
    permissions: Array.from(permissions),
    scopedCountryIds: Array.from(allScopedCountries),
    countryScopes,
  };
}

export interface ScopedActor {
  accountType: AccountType;
  countryScopes?: Record<string, string[]>;
}

/** Portée de l'acteur pour une permission : null = tout, sinon les pays autorisés. Le SuperAdmin n'a jamais de limite. */
export function scopeOf(actor: ScopedActor, permission: PermissionKey): CountryScope {
  if (actor.accountType === AccountType.SUPERADMIN) return null;
  const ids = actor.countryScopes?.[permission];
  return ids && ids.length > 0 ? ids : null;
}

// ---------------------------------------------------------------------------
// Filtres Prisma : « ce dossier relève de l'un de ces pays »
// ---------------------------------------------------------------------------

const inCountries = (ids: string[]) => ({ in: ids });

export function driverScopeWhere(ids: string[]): Prisma.DriverProfileWhereInput {
  return { countryId: inCountries(ids) };
}

export function customerScopeWhere(ids: string[]): Prisma.CustomerProfileWhereInput {
  return { OR: [{ countryId: inCountries(ids) }, { city: { countryId: inCountries(ids) } }] };
}

/** Compte client ou conducteur rattaché au pays (les comptes d'équipe, sans profil, n'ont pas de pays). */
export function userScopeWhere(ids: string[]): Prisma.UserWhereInput {
  return { OR: [{ customerProfile: customerScopeWhere(ids) }, { driverProfile: driverScopeWhere(ids) }] };
}

export function vehicleScopeWhere(ids: string[]): Prisma.VehicleWhereInput {
  return { driver: driverScopeWhere(ids) };
}

export function tripScopeWhere(ids: string[]): Prisma.TripWhereInput {
  return {
    OR: [
      { originCity: { countryId: inCountries(ids) } },
      { destinationCity: { countryId: inCountries(ids) } },
      { driver: driverScopeWhere(ids) },
    ],
  };
}

export function bookingScopeWhere(ids: string[]): Prisma.BookingWhereInput {
  return { OR: [{ trip: tripScopeWhere(ids) }, { customer: customerScopeWhere(ids) }] };
}

export function shipmentScopeWhere(ids: string[]): Prisma.ShipmentWhereInput {
  return {
    OR: [
      { trip: tripScopeWhere(ids) },
      { driver: driverScopeWhere(ids) },
      { customer: customerScopeWhere(ids) },
      { senderLocation: { city: { countryId: inCountries(ids) } } },
      { recipientLocation: { city: { countryId: inCountries(ids) } } },
    ],
  };
}

export function disputeScopeWhere(ids: string[]): Prisma.DisputeWhereInput {
  return { OR: [{ booking: bookingScopeWhere(ids) }, { shipment: shipmentScopeWhere(ids) }] };
}

export function verificationScopeWhere(ids: string[]): Prisma.VerificationWhereInput {
  return { OR: [{ driver: driverScopeWhere(ids) }, { user: userScopeWhere(ids) }] };
}

export function walletScopeWhere(ids: string[]): Prisma.WalletWhereInput {
  return { driver: driverScopeWhere(ids) };
}

export function payoutScopeWhere(ids: string[]): Prisma.PayoutWhereInput {
  return { wallet: walletScopeWhere(ids) };
}

/** Conversation client ↔ conducteur : dans le périmètre si l'un des deux l'est. */
export function conversationScopeWhere(ids: string[]): Prisma.ConversationWhereInput {
  return { OR: [{ customer: customerScopeWhere(ids) }, { driver: driverScopeWhere(ids) }] };
}

/**
 * Combine un filtre de portée (éventuel) avec un `where` existant sans jamais le remplacer : les deux
 * conditions s'appliquent. Sans portée, renvoie le `where` tel quel — comportement historique intact.
 */
export function withScope<T extends object>(where: T, scopeWhere: object | undefined): T {
  if (!scopeWhere) return where;
  return { AND: [where, scopeWhere] } as unknown as T;
}