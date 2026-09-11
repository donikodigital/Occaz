// backend/src/users/users.controller.ts
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @Permissions(PERMISSIONS.USER_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('accountType') accountType?: AccountType,
  ) {
    return this.usersService.findAll(query, accountType);
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
}
