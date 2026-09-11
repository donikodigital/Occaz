// backend/src/seed/run-accounts-seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccountsSeedService } from './accounts.seed';

/**
 * Script de seed autonome — usage : `npm run seed:accounts`.
 * Suppose que `npm run seed:rbac` a déjà été exécuté (les rôles
 * doivent exister avant qu'on puisse y rattacher ces comptes).
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(AccountsSeedService);
  await seeder.run();
  await app.close();
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du seed des comptes :', error);
  process.exit(1);
});
