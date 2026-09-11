// backend/src/devices/devices.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Appareils')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.findAllForUser(user.id);
  }

  @Post()
  register(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.register(user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.remove(id, user.id);
  }
}
