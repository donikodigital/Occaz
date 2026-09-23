// backend/src/users/users.controller.ts
// [22/09/2026] v+ — route DELETE /users/me (suppression de compte en libre-service).
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getSafeById(user.id);
  }

  @Patch('me')
  updateMe(@Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.updateSelf(user.id, dto);
  }

  /**
   * Suppression de compte en libre-service — voir UsersService.deleteSelf.
   * En POST plutôt qu'en DELETE : un corps de requête sur une méthode
   * DELETE est parfois filtré par un proxy ou un client HTTP en amont,
   * ici indispensable pour transmettre le motif facultatif.
   */
  @Post('me/delete')
  deleteMe(@Body() dto: DeleteAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteSelf(user.id, dto);
  }

  /**
   * Un seul DTO pour toute la query (pagination, recherche, accountType) :
   * un @Query('accountType') séparé serait rejeté en 400 par le
   * ValidationPipe global (forbidNonWhitelisted) — voir ListUsersQueryDto.
   */
  @Permissions(PERMISSIONS.USER_READ)
  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query, query.accountType);
  }

  @Permissions(PERMISSIONS.USER_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.getSafeById(id);
  }

  @Permissions(PERMISSIONS.USER_SUSPEND)
  @Patch(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.suspend(id, reason, user.id);
  }

  @Permissions(PERMISSIONS.USER_SUSPEND)
  @Patch(':id/unsuspend')
  unsuspend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.unsuspend(id, user.id);
  }

  @Permissions(PERMISSIONS.USER_UPDATE)
  @Patch(':id')
  adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.adminUpdate(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.USER_DELETE)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivate(id, user.id);
  }

  @Permissions(PERMISSIONS.USER_DELETE)
  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.activate(id, user.id);
  }
}