// backend/src/rbac/rbac.module.ts
import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';
import { RbacSeedService } from './rbac.seed';

@Module({
  controllers: [RolesController, PermissionsController, UserRolesController],
  providers: [RolesService, PermissionsService, UserRolesService, RbacSeedService],
  exports: [RolesService, PermissionsService, UserRolesService],
})
export class RbacModule {}
