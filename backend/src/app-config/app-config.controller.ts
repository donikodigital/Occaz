// backend/src/app-config/app-config.controller.ts
// [19/10/2026] v1 — GET /api/v1/app-config : public (l'application le lit avant même la connexion). Ne renvoie rien de sensible.
import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from './app-config.service';

@ApiTags('Application')
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  get() {
    return this.config.getPublicConfig();
  }
}
