// backend/src/common/scope/country-scope.spec.ts
import { AccountType } from '@prisma/client';
import { PERMISSIONS } from '../constants/permissions.constants';
import {
  GLOBAL_ONLY_PERMISSIONS,
  disputeScopeWhere,
  resolveEffectivePermissions,
  scopeOf,
  withScope,
} from './country-scope';

describe('resolveEffectivePermissions', () => {
  it('un rôle sans pays accorde ses permissions partout (aucune portée)', () => {
    const result = resolveEffectivePermissions([
      { countryId: null, permissionKeys: [PERMISSIONS.USER_READ, PERMISSIONS.DISPUTE_READ] },
    ]);
    expect(result.permissions.sort()).toEqual([PERMISSIONS.DISPUTE_READ, PERMISSIONS.USER_READ].sort());
    expect(result.countryScopes).toEqual({});
    expect(result.scopedCountryIds).toEqual([]);
  });

  it('un rôle limité à un pays restreint ses permissions à ce pays', () => {
    const result = resolveEffectivePermissions([{ countryId: 'GN', permissionKeys: [PERMISSIONS.DISPUTE_READ] }]);
    expect(result.permissions).toEqual([PERMISSIONS.DISPUTE_READ]);
    expect(result.countryScopes).toEqual({ [PERMISSIONS.DISPUTE_READ]: ['GN'] });
    expect(result.scopedCountryIds).toEqual(['GN']);
  });

  it('plusieurs rôles limités : les pays s\'additionnent par permission', () => {
    const result = resolveEffectivePermissions([
      { countryId: 'GN', permissionKeys: [PERMISSIONS.DISPUTE_READ] },
      { countryId: 'SN', permissionKeys: [PERMISSIONS.DISPUTE_READ, PERMISSIONS.USER_READ] },
    ]);
    expect(result.countryScopes[PERMISSIONS.DISPUTE_READ].sort()).toEqual(['GN', 'SN']);
    expect(result.countryScopes[PERMISSIONS.USER_READ]).toEqual(['SN']);
  });

  it('une permission accordée aussi par un rôle global n\'est plus limitée', () => {
    const result = resolveEffectivePermissions([
      { countryId: 'GN', permissionKeys: [PERMISSIONS.DISPUTE_READ, PERMISSIONS.USER_READ] },
      { countryId: null, permissionKeys: [PERMISSIONS.DISPUTE_READ] },
    ]);
    expect(result.countryScopes[PERMISSIONS.DISPUTE_READ]).toBeUndefined(); // globale
    expect(result.countryScopes[PERMISSIONS.USER_READ]).toEqual(['GN']); // reste limitée
  });

  it('une permission de configuration accordée seulement par pays est ignorée', () => {
    const result = resolveEffectivePermissions([
      { countryId: 'GN', permissionKeys: [PERMISSIONS.SETTINGS_UPDATE, PERMISSIONS.DASHBOARD_ADMIN_READ, PERMISSIONS.USER_READ] },
    ]);
    expect(result.permissions).toEqual([PERMISSIONS.USER_READ]);
  });

  it('une permission de configuration accordée par un rôle global reste effective', () => {
    const result = resolveEffectivePermissions([
      { countryId: null, permissionKeys: [PERMISSIONS.AUDIT_READ] },
      { countryId: 'GN', permissionKeys: [PERMISSIONS.AUDIT_READ] },
    ]);
    expect(result.permissions).toEqual([PERMISSIONS.AUDIT_READ]);
    expect(result.countryScopes).toEqual({});
  });

  it('GLOBAL_ONLY_PERMISSIONS ne contient aucune permission de données par pays', () => {
    for (const key of [
      PERMISSIONS.USER_READ,
      PERMISSIONS.DRIVER_READ,
      PERMISSIONS.DISPUTE_READ,
      PERMISSIONS.REFUND_CREATE,
      PERMISSIONS.PAYOUT_MANAGE,
    ]) {
      expect(GLOBAL_ONLY_PERMISSIONS.has(key)).toBe(false);
    }
  });
});

describe('scopeOf', () => {
  const supportScoped = {
    accountType: AccountType.SUPPORT,
    countryScopes: { [PERMISSIONS.DISPUTE_READ]: ['GN'] },
  };

  it('renvoie les pays pour une permission limitée', () => {
    expect(scopeOf(supportScoped, PERMISSIONS.DISPUTE_READ)).toEqual(['GN']);
  });

  it('renvoie null (aucune limite) pour une permission accordée partout', () => {
    expect(scopeOf(supportScoped, PERMISSIONS.USER_READ)).toBeNull();
  });

  it('le SuperAdmin n\'est jamais limité', () => {
    expect(
      scopeOf({ accountType: AccountType.SUPERADMIN, countryScopes: { [PERMISSIONS.DISPUTE_READ]: ['GN'] } }, PERMISSIONS.DISPUTE_READ),
    ).toBeNull();
  });

  it('tolère un acteur sans table de portées', () => {
    expect(scopeOf({ accountType: AccountType.SUPPORT }, PERMISSIONS.DISPUTE_READ)).toBeNull();
  });
});

describe('filtres Prisma', () => {
  it('withScope laisse le where intact sans portée', () => {
    const where = { status: 'OPENED' };
    expect(withScope(where, undefined)).toBe(where);
  });

  it('withScope cumule le where existant et la portée (jamais un remplacement)', () => {
    const where = { status: 'OPENED' };
    const scope = { countryId: { in: ['GN'] } };
    expect(withScope(where, scope)).toEqual({ AND: [where, scope] });
  });

  it('un litige relève du pays si sa réservation ou son envoi en relève', () => {
    const where = disputeScopeWhere(['GN']);
    expect(Object.keys(where)).toEqual(['OR']);
    expect((where.OR as unknown[]).length).toBe(2);
  });
});