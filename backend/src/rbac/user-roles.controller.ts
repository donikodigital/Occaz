// backend/src/rbac/user-roles.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { UserRolesService } from './user-roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';

@ApiTags('RBAC — Attribution de rôles')
@ApiBearerAuth()
@Permissions(PERMISSIONS.ROLE_MANAGE)
@Controller('user-roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get(':userId')
  findAllForUser(@Param('userId') userId: string) {
    return this.userRolesService.findAllForUser(userId);
  }

  @Post()
  assign(@Body() dto: AssignRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.userRolesService.assign(dto, user.id);
  }

  @Delete(':userRoleId')
  revoke(@Param('userRoleId') userRoleId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.userRolesService.revoke(userRoleId, user.id);
  }
}
