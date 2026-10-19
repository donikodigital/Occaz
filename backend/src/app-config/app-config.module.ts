// backend/src/app-config/app-config.module.ts
// [19/10/2026] v1 — Réglages publics de l'application mobile (version minimale exigée).
import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService],
})
export class AppConfigModule {}
