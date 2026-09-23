// backend/src/rbac/rbac.seed.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS } from '../common/constants/permissions.constants';

/**
 * Données de référence RBAC — reprend les niveaux d'exemple du cahier des
 * charges (section 4) : agent clientèle / superviseur clientèle /
 * responsable financier, plus un rôle superadmin complet. À exécuter une
 * fois par environnement via `npm run seed:rbac` (voir seed.ts).
 */
const DEFAULT_ROLES: { key: string; name: string; permissionKeys: string[] }[] = [
  {
    key: 'superadmin',
    name: 'Super administrateur',
    permissionKeys: Object.values(PERMISSIONS),
  },
  {
    key: 'support_agent',
    name: 'Agent clientèle',
    permissionKeys: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.DRIVER_READ,
      PERMISSIONS.VEHICLE_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.TRIP_READ,
      PERMISSIONS.BOOKING_READ,
      PERMISSIONS.SHIPMENT_READ,
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.DISPUTE_READ,
      PERMISSIONS.CONVERSATION_READ,
    ],
  },
  {
    key: 'support_supervisor',
    name: 'Superviseur clientèle',
    permissionKeys: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_SUSPEND,
      PERMISSIONS.DRIVER_READ,
      PERMISSIONS.DRIVER_VERIFY,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_VERIFY,
      PERMISSIONS.TRIP_READ,
      PERMISSIONS.BOOKING_READ,
      PERMISSIONS.SHIPMENT_READ,
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.REFUND_CREATE,
      PERMISSIONS.DISPUTE_READ,
      PERMISSIONS.DISPUTE_RESOLVE,
      PERMISSIONS.DISPUTE_ASSIGN,
      PERMISSIONS.CONVERSATION_READ,
    ],
  },
  {
    key: 'finance_manager',
    name: 'Responsable financier',
    permissionKeys: [
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.PAYMENT_PROVIDER_MANAGE,
      PERMISSIONS.REFUND_CREATE,
      PERMISSIONS.PAYOUT_MANAGE,
      PERMISSIONS.COMMISSION_MANAGE,
      PERMISSIONS.PROMOTION_MANAGE,
      PERMISSIONS.CANCELLATION_POLICY_MANAGE,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.DASHBOARD_ADMIN_READ,
    ],
  },
];

@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async run(): Promise<void> {
    for (const key of Object.values(PERMISSIONS)) {
      await this.permissionsService.ensureExists(key);
    }
    this.logger.log(`${Object.values(PERMISSIONS).length} permissions vérifiées/créées.`);

    for (const roleDef of DEFAULT_ROLES) {
      const permissions = await this.prisma.permission.findMany({
        where: { key: { in: roleDef.permissionKeys } },
      });

      await this.prisma.role.upsert({
        where: { key: roleDef.key },
        update: { name: roleDef.name },
        create: {
          key: roleDef.key,
          name: roleDef.name,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });
      this.logger.log(`Rôle "${roleDef.key}" synchronisé.`);
    }
  }
}