// backend/src/common/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountType } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionKey } from '../constants/permissions.constants';
import { RequestWithUser } from '../types/request-with-user.interface';

/**
 * Vérifie que l'utilisateur authentifié possède, via ses UserRole, au
 * moins une des permissions requises par @Permissions(...). Le SuperAdmin
 * a toujours accès (droits maximum, section 3.1) sans avoir besoin d'une
 * permission explicite pour chaque route.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return false;
    if (user.accountType === AccountType.SUPERADMIN) return true;

    const hasPermission = required.some((permission) =>
      user.permissions.includes(permission),
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        `Permission manquante : ${required.join(' ou ')}.`,
      );
    }
    return true;
  }
}
