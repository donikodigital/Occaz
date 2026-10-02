// backend/src/users/users.controller.ts
// [22/09/2026] v+ — route DELETE /users/me (suppression de compte en libre-service).
// [02/10/2026] v+ — GET /users/me renvoie aussi les permissions effectives (le back-office s'en sert pour
// n'afficher que ce que le compte a le droit de faire) ; liste et fiche filtrées selon l'acteur.
// [02/10/2026] v+ — Portée par pays : un compte dont le rôle est limité à un pays ne voit et ne gère que les
// clients et chauffeurs de ce pays ; /users/me indique aussi les pays de son périmètre (`scopedCountries`).
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly scope: CountryScopeService,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const safeUser = await this.usersService.getSafeById(user.id);
    const scopedCountries = await this.scope.describeScope(user);
    return { ...safeUser, permissions: user.permissions, scopedCountries };
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
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(
      query,
      query.accountType,
      user,
      this.scope.userListWhere(user, PERMISSIONS.USER_READ),
    );
  }

  @Permissions(PERMISSIONS.USER_READ)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_READ, id);
    return this.usersService.getSafeByIdForActor(id, user);
  }

  @Permissions(PERMISSIONS.USER_SUSPEND)
  @Patch(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertUser(user, PERMISSIONS.USER_SUSPEND, id);
    return this.usersService.suspend(id, reason, user.id);
  }

  @Permissions(PERMISSIONS.USER_SUSPEND)
  @Patch(':id/unsuspend')
  async unsuspend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_SUSPEND, id);
    return this.usersService.unsuspend(id, user.id);
  }

  @Permissions(PERMISSIONS.USER_UPDATE)
  @Patch(':id')
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertUser(user, PERMISSIONS.USER_UPDATE, id);
    return this.usersService.adminUpdate(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.USER_DELETE)
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_DELETE, id);
    return this.usersService.deactivate(id, user.id);
  }

  @Permissions(PERMISSIONS.USER_DELETE)
  @Patch(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_DELETE, id);
    return this.usersService.activate(id, user.id);
  }
}