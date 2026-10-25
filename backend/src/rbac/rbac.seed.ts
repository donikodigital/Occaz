// backend/src/rbac/rbac.seed.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS } from '../common/constants/permissions.constants';

// [25/10/2026] v+ — Les rôles service client reçoivent aussi les droits « Documents de l'entreprise » (lecture et dépôt).
// [16/10/2026] v+ — Rôles « service client » recadrés : ils servent à aider les clients et les conducteurs (consulter trajets et colis,
// recevoir et traiter les litiges, valider un code en cas de litige, suspendre un compte, envoyer un rappel après un signalement, suivre les
// alertes SOS) et RIEN d'autre : aucun paramétrage, aucune finance (soldes, commissions, retraits, portefeuille de la plateforme), pas
// de tableau de bord administrateur. `enforce` : à chaque exécution du seed, les permissions du rôle sont remises exactement à cette liste
// (un droit ajouté à la main sur ce rôle est retiré) — pour un cas particulier, créer un autre rôle depuis la page « Rôles ».
/**
 * Données de référence RBAC — reprend les niveaux d'exemple du cahier des
 * charges (section 4) : agent clientèle / superviseur clientèle /
 * responsable financier, plus un rôle superadmin complet. À exécuter une
 * fois par environnement via `npm run seed:rbac` (voir seed.ts).
 */
/** Ce que fait tout agent du service client. */
const SUPPORT_AGENT_PERMISSIONS: string[] = [
  // Consulter : comptes, conducteurs, véhicules, documents, trajets, réservations, colis, échanges
  PERMISSIONS.USER_READ,
  PERMISSIONS.CUSTOMER_READ,
  PERMISSIONS.DRIVER_READ,
  PERMISSIONS.VEHICLE_READ,
  PERMISSIONS.DOCUMENT_READ,
  PERMISSIONS.TRIP_READ,
  PERMISSIONS.BOOKING_READ,
  PERMISSIONS.SHIPMENT_READ,
  PERMISSIONS.CONVERSATION_READ,
  // Litiges : les recevoir, répondre, trancher (dont valider un code à la place d'un client qui ne le donne pas)
  PERMISSIONS.DISPUTE_READ,
  PERMISSIONS.DISPUTE_RESOLVE,
  // Sécurité : signalements (y compris le message de rappel) et alertes SOS
  PERMISSIONS.USER_REPORT_READ,
  PERMISSIONS.USER_REPORT_MANAGE,
  PERMISSIONS.SOS_READ,
  PERMISSIONS.SOS_MANAGE,
  // Suspendre / réactiver un compte client ou conducteur
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.DRIVER_SUSPEND,
  // Rembourser un client (depuis un litige ou à la main)
  PERMISSIONS.REFUND_CREATE,
  // Documents de l'entreprise (PV de réunion, etc.) : les consulter et y déposer les siens. Un document sensible se marque « Réservé » :
  // seuls le SuperAdmin et la personne qui l'a déposé le voient. Pour retirer l'accès à un rôle, décocher ces deux droits dans « Rôles ».
  PERMISSIONS.COMPANY_DOCUMENT_READ,
  PERMISSIONS.COMPANY_DOCUMENT_MANAGE,
];

const DEFAULT_ROLES: { key: string; name: string; permissionKeys: string[]; enforce?: boolean }[] = [
  {
    key: 'superadmin',
    name: 'Super administrateur',
    permissionKeys: Object.values(PERMISSIONS),
  },
  {
    key: 'support_agent',
    name: 'Agent clientèle',
    enforce: true,
    permissionKeys: SUPPORT_AGENT_PERMISSIONS,
  },
  {
    key: 'support_supervisor',
    name: 'Superviseur clientèle',
    enforce: true,
    // Comme l'agent, plus : confier les litiges à un agent, vérifier conducteurs / véhicules / documents.
    permissionKeys: [
      ...SUPPORT_AGENT_PERMISSIONS,
      PERMISSIONS.DISPUTE_ASSIGN,
      PERMISSIONS.DRIVER_VERIFY,
      PERMISSIONS.VEHICLE_VERIFY,
      PERMISSIONS.DOCUMENT_VERIFY,
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

      const role = await this.prisma.role.upsert({
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

      if (roleDef.enforce) {
        // Remise exacte des permissions du rôle : retire ce qui aurait été ajouté en trop, ajoute ce qui manque.
        await this.prisma.$transaction([
          this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
          this.prisma.rolePermission.createMany({
            data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
          }),
        ]);
      }
      this.logger.log(`Rôle "${roleDef.key}" synchronisé${roleDef.enforce ? ` (${permissions.length} permissions)` : ''}.`);
    }
  }
}
