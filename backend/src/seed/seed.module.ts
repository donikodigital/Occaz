// backend/src/seed/seed.module.ts
import { Module } from '@nestjs/common';
import { AccountsSeedService } from './accounts.seed';

@Module({
  providers: [AccountsSeedService],
})
export class SeedModule {}
