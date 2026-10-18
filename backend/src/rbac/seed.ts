// backend/src/rbac/seed.ts
// [16/10/2026] v2 — Vrai script de seed : ce fichier ne contenait qu'une ancienne copie de la classe RbacSeedService et n'exécutait rien,
// si bien que `npm run seed:rbac` ne créait ni ne mettait à jour aucun rôle. Il lance maintenant RbacSeedService (rbac.seed.ts).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeedService } from './rbac.seed';

/**
 * Usage : `npm run seed:rbac`. Crée les permissions et les rôles de référence ; remet les rôles « service client »
 * (support_agent, support_supervisor) exactement à leur liste de permissions. Réexécutable sans risque.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(RbacSeedService).run();
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du seed RBAC :', error);
  process.exit(1);
});
