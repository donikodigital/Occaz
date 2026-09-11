// backend/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global() : PrismaService est injectable partout sans réimporter ce
 * module dans chaque feature module — un seul pool de connexions pour
 * toute l'application.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
