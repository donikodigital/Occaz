// backend/src/common/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../constants/permissions.constants';

/**
 * Déclare la ou les permissions requises pour accéder à une route.
 * Lu par PermissionsGuard, qui vérifie les permissions effectives de
 * l'utilisateur (via ses UserRole) avant d'autoriser l'accès.
 *
 * Exemple : @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
