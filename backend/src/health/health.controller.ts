// backend/src/health/health.controller.ts
import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deux routes distinctes, pas une seule — c'est la convention
 * liveness/readiness standard (Kubernetes, Render, la plupart des
 * orchestrateurs) :
 *   - /health       : le process répond-il du tout ? Jamais de
 *     dépendance externe ici — sinon un Neon en pause (voir la section
 *     autosuspend du README) ferait passer l'instance pour morte et la
 *     ferait redémarrer en boucle, alors qu'elle va bien.
 *   - /health/ready : peut-on lui envoyer du trafic maintenant ? Ici on
 *     vérifie la base — un service qui répond mais ne peut rien lire
 *     ni écrire ne doit pas recevoir de requêtes.
 * Exclu de Swagger (bruit inutile dans la doc publique) et du
 * throttling (un orchestrateur interroge ces routes en continu).
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @SkipThrottle()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
  }
}
