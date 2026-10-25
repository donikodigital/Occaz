// backend/src/user-safety/user-safety.controllers.ts
// [25/10/2026] v4 — PATCH /reports/:id et PATCH /sos/:id respectent la portée par pays (404 hors périmètre).
// [23/10/2026] v3 — listes /reports et /sos : filtres via ListUserReportsQueryDto / ListSosQueryDto (le filtre de statut faisait échouer la requête en 400).
// [16/10/2026] v2 — POST /reports/:id/remind : message de rappel du service client.
// [11/10/2026] v1 — routes de la sécurité : /blocks, /reports, /emergency-contacts, /sos. Les routes d'administration (support) demandent une
// permission (user_report.* / sos.*) et respectent la portée par pays ; les autres ne concernent que l'utilisateur connecté.
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { UserBlocksService } from './user-blocks.service';
import { UserReportsService } from './user-reports.service';
import { EmergencyContactsService } from './emergency-contacts.service';
import { SosService } from './sos.service';
import {
  BlockUserDto,
  CreateEmergencyContactDto,
  CreateSosDto,
  CreateUserReportDto,
  HandleSosDto,
  ListSosQueryDto,
  ListUserReportsQueryDto,
  RemindUserReportDto,
  UpdateSosLocationDto,
  UpdateUserReportDto,
} from './dto/user-safety.dto';

@ApiTags('Sécurité — blocages')
@ApiBearerAuth()
@Controller('blocks')
export class UserBlocksController {
  constructor(private readonly blocks: UserBlocksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.blocks.listMine(user.id);
  }

  @Post()
  async block(@Body() dto: BlockUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.blocks.block(user.id, await this.blocks.resolveTargetUserId(dto));
  }

  @Delete(':userId')
  unblock(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.blocks.unblock(user.id, userId);
  }
}

@ApiTags('Sécurité — signalements')
@ApiBearerAuth()
@Controller('reports')
export class UserReportsController {
  constructor(
    private readonly reports: UserReportsService,
    private readonly scope: CountryScopeService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateUserReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.create(user.id, dto);
  }

  @Permissions(PERMISSIONS.USER_REPORT_READ)
  @Get('open-count')
  openCount() {
    return this.reports.openCount();
  }

  @Permissions(PERMISSIONS.USER_REPORT_READ)
  @Get()
  findAll(
    @Query() query: ListUserReportsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.findAll(query, { status: query.status, reportedUserId: query.reportedUserId }, this.scope.userWhere(user, PERMISSIONS.USER_REPORT_READ));
  }

  /** Rappel envoyé par le service client à la personne signalée (ou à celle qui a signalé). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Permissions(PERMISSIONS.USER_REPORT_MANAGE)
  @Post(':id/remind')
  async remind(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RemindUserReportDto, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_REPORT_MANAGE, await this.reports.reportedUserIdOf(id));
    return this.reports.remind(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.USER_REPORT_MANAGE)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserReportDto, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.USER_REPORT_MANAGE, await this.reports.reportedUserIdOf(id));
    return this.reports.update(id, dto, user.id);
  }
}

@ApiTags('Sécurité — contacts d’urgence')
@ApiBearerAuth()
@Controller('emergency-contacts')
export class EmergencyContactsController {
  constructor(private readonly contacts: EmergencyContactsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.list(user.id);
  }

  @Post()
  add(@Body() dto: CreateEmergencyContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.add(user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.remove(user.id, id);
  }
}

@ApiTags('Sécurité — SOS')
@ApiBearerAuth()
@Controller('sos')
export class SosController {
  constructor(
    private readonly sos: SosService,
    private readonly scope: CountryScopeService,
  ) {}

  /** Déclenche l'alerte. Limite large (un appui répété ne doit jamais être refusé), mais bornée contre les abus. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  trigger(@Body() dto: CreateSosDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sos.trigger(user.id, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.sos.listMine(user.id);
  }

  @Permissions(PERMISSIONS.SOS_READ)
  @Get('open-count')
  openCount() {
    return this.sos.openCount();
  }

  @Permissions(PERMISSIONS.SOS_READ)
  @Get()
  findAll(@Query() query: ListSosQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sos.findAll(query, { status: query.status }, this.scope.userWhere(user, PERMISSIONS.SOS_READ));
  }

  @Post(':id/location')
  location(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSosLocationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sos.updateLocation(user.id, id, dto.latitude, dto.longitude);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sos.cancel(user.id, id);
  }

  @Permissions(PERMISSIONS.SOS_MANAGE)
  @Patch(':id')
  async handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleSosDto, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertUser(user, PERMISSIONS.SOS_MANAGE, await this.sos.userIdOf(id));
    return this.sos.handle(id, dto, user.id);
  }
}
