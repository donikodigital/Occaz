// backend/src/prisma/prisma.service.ts
import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Modèles portant `deletedAt` (soft delete) — voir Partie VII du cahier
 * des charges. Toute nouvelle entité soft-deletable ajoutée au schéma doit
 * être ajoutée ici pour bénéficier automatiquement du filtrage.
 */
const SOFT_DELETE_MODELS = new Set([
  'User',
  'CustomerProfile',
  'DriverProfile',
  'Vehicle',
  'Document',
  'Location',
  'Trip',
  'Booking',
  'Shipment',
]);

const READ_ACTIONS = new Set(['findUnique', 'findFirst', 'findMany', 'count', 'aggregate']);
const WRITE_ACTIONS_DELETE_ONE = new Set(['delete']);
const WRITE_ACTIONS_DELETE_MANY = new Set(['deleteMany']);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.get<string>('database.url')! },
      },
      log:
        configService.get<string>('nodeEnv') === 'development'
          ? ['warn', 'error']
          : ['error'],
    });

    this.registerSoftDeleteMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connexion PostgreSQL établie.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Ferme proprement les connexions lors de l'arrêt de l'application. */
  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * Middleware Prisma appliquant le soft delete de façon transparente :
   *   - les lectures excluent automatiquement les lignes deletedAt != null
   *     sauf si l'appelant passe explicitement `where: { deletedAt: { not: undefined } }`
   *   - delete / deleteMany deviennent des update posant deletedAt = now()
   * Ceci évite qu'un service oublie de filtrer une entité archivée —
   * décision Partie VII (createdAt/updatedAt/deletedAt systématiques).
   */
  private registerSoftDeleteMiddleware() {
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
        return next(params);
      }

      if (READ_ACTIONS.has(params.action)) {
        params.args = params.args ?? {};
        if (params.args.where?.deletedAt === undefined) {
          params.args.where = { ...params.args.where, deletedAt: null };
        }
      }

      if (WRITE_ACTIONS_DELETE_ONE.has(params.action)) {
        params.action = 'update';
        params.args.data = { deletedAt: new Date() };
      }

      if (WRITE_ACTIONS_DELETE_MANY.has(params.action)) {
        params.action = 'updateMany';
        params.args.data = { ...(params.args.data ?? {}), deletedAt: new Date() };
      }

      return next(params);
    });
  }
}
