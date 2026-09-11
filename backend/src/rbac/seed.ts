// backend/src/rbac/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeedService } from './rbac.seed';

/**
 * Script de seed autonome — usage : `npm run seed:rbac`.
 * Crée un contexte Nest complet (DI, config, Prisma) sans démarrer le
 * serveur HTTP, exécute le seed, puis quitte.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(RbacSeedService);
  await seeder.run();
  await app.close();
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du seed RBAC :', error);
  process.exit(1);
});
