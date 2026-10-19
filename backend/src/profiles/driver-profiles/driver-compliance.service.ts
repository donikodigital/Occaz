// backend/src/profiles/driver-profiles/driver-compliance.service.ts
// [19/10/2026] v1 — Régularisation d'un conducteur dont le dossier n'est pas encore validé.
//
// Règle (réglable sans redéployer : réglage « driver.pending_grace_days », 7 jours par défaut, depuis la création du profil conducteur) :
//   • conducteur VALIDÉ : tout est permis (trajets et colis) ;
//   • conducteur en attente (PENDING / IN_VERIFICATION) : il peut créer et publier des trajets ET transporter des passagers pendant le délai.
//     Passé ce délai, la création de trajets est bloquée tant que son dossier n'est pas régularisé. Il garde la main sur ses trajets déjà
//     réservés. Exception voulue : un dossier COMPLET (photo, permis, véhicule, carte grise tous envoyés et non refusés) qui attend seulement
//     l'examen de l'équipe n'est jamais bloqué — on ne pénalise pas un conducteur parce que la vérification prend du temps ;
//   • colis : réservés aux conducteurs validés, sans délai de tolérance (voir ShipmentsService.requireEligibleDriver) ;
//   • compte suspendu / bloqué / désactivé : aucun trajet.
//
// Un document REFUSÉ ou expiré compte comme manquant : il faut le renvoyer.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentStatus, DriverAccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOCUMENT_TYPES } from '../../documents/constants/document-types.constants';

export const DRIVER_GRACE_DAYS_KEY = 'driver.pending_grace_days';
export const DEFAULT_GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export type DriverRequirement = 'photo' | 'driver_license' | 'vehicle' | 'vehicle_registration';

export const REQUIREMENT_LABELS: Record<DriverRequirement, string> = {
  photo: 'photo de profil',
  driver_license: 'permis de conduire',
  vehicle: 'véhicule',
  vehicle_registration: 'carte grise du véhicule',
};

export interface DriverComplianceInput {
  status: DriverAccountStatus;
  createdAt: Date;
  hasPhoto: boolean;
  hasDriverLicense: boolean;
  vehicleCount: number;
  hasVehicleRegistration: boolean;
  graceDays: number;
  now: Date;
}

export interface DriverCompliance {
  status: DriverAccountStatus;
  /** Compte validé : en règle. */
  isCompliant: boolean;
  /** Pièces à fournir (ou à renvoyer). Vide = dossier complet. */
  missing: DriverRequirement[];
  missingLabels: string[];
  /** Dossier complet qui attend seulement l'examen de l'équipe. */
  awaitingReview: boolean;
  graceDays: number;
  /** Fin du délai de tolérance. */
  deadlineAt: Date;
  /** Jours entiers restants avant le blocage (0 le dernier jour et après l'échéance). */
  daysLeft: number;
  graceExpired: boolean;
  canCreateTrips: boolean;
  /** Seuls les conducteurs validés prennent des colis. */
  canCarryShipments: boolean;
  /** Pourquoi la création de trajets est refusée (null quand elle est permise). */
  blockedReason: string | null;
}

const LOCKED_STATUSES: DriverAccountStatus[] = [
  DriverAccountStatus.SUSPENDED,
  DriverAccountStatus.BLOCKED,
  DriverAccountStatus.DEACTIVATED,
];

/** Liste lisible : « photo de profil, permis de conduire et carte grise du véhicule ». */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

/** Règle pure (sans base de données) — testée à part. */
export function computeCompliance(input: DriverComplianceInput): DriverCompliance {
  const missing: DriverRequirement[] = [];
  if (!input.hasPhoto) missing.push('photo');
  if (!input.hasDriverLicense) missing.push('driver_license');
  if (input.vehicleCount === 0) missing.push('vehicle');
  if (!input.hasVehicleRegistration) missing.push('vehicle_registration');
  const missingLabels = missing.map((requirement) => REQUIREMENT_LABELS[requirement]);

  const isCompliant = input.status === DriverAccountStatus.VALIDATED;
  const locked = LOCKED_STATUSES.includes(input.status);
  const awaitingReview = !isCompliant && !locked && missing.length === 0;

  const graceDays = Math.max(0, Math.floor(input.graceDays));
  const deadlineAt = new Date(input.createdAt.getTime() + graceDays * DAY_MS);
  const msLeft = deadlineAt.getTime() - input.now.getTime();
  const graceExpired = msLeft < 0;
  const daysLeft = graceExpired ? 0 : Math.ceil(msLeft / DAY_MS);

  const canCreateTrips = isCompliant || (!locked && (awaitingReview || !graceExpired));

  let blockedReason: string | null = null;
  if (!canCreateTrips) {
    blockedReason = locked
      ? 'Votre compte conducteur est suspendu : vous ne pouvez pas créer de trajet.'
      : `Le délai de ${graceDays} jour${graceDays > 1 ? 's' : ''} pour régulariser votre dossier est dépassé. Envoyez : ${joinLabels(missingLabels)}. Vous pourrez de nouveau créer des trajets dès que ces pièces seront envoyées.`;
  }

  return {
    status: input.status,
    isCompliant,
    missing,
    missingLabels,
    awaitingReview,
    graceDays,
    deadlineAt,
    daysLeft,
    graceExpired,
    canCreateTrips,
    canCarryShipments: isCompliant,
    blockedReason,
  };
}

@Injectable()
export class DriverComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Délai de tolérance en jours (réglage de l'administration, 7 par défaut). */
  async graceDays(): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key: DRIVER_GRACE_DAYS_KEY } });
    const value = typeof setting?.value === 'number' ? setting.value : Number(setting?.value);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_GRACE_DAYS;
  }

  async evaluate(driverProfileId: string, now: Date = new Date()): Promise<DriverCompliance> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        photoUrl: true,
        vehicles: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!profile) throw new NotFoundException('Profil conducteur introuvable.');
    return this.evaluateLoaded(profile, now);
  }

  /** Variante sans relecture du profil, pour les traitements par lots qui l'ont déjà. */
  async evaluateLoaded(
    profile: { id: string; status: DriverAccountStatus; createdAt: Date; photoUrl: string | null; vehicles: { id: string }[] },
    now: Date = new Date(),
  ): Promise<DriverCompliance> {
    const vehicleIds = profile.vehicles.map((vehicle) => vehicle.id);
    const documents = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        status: { in: [DocumentStatus.PENDING, DocumentStatus.VERIFIED] },
        OR: [
          { ownerType: DocumentOwnerType.DRIVER, ownerId: profile.id, type: DOCUMENT_TYPES.DRIVER_LICENSE },
          ...(vehicleIds.length > 0
            ? [{ ownerType: DocumentOwnerType.VEHICLE, ownerId: { in: vehicleIds }, type: DOCUMENT_TYPES.VEHICLE_REGISTRATION }]
            : []),
        ],
      },
      select: { ownerType: true, type: true },
    });

    return computeCompliance({
      status: profile.status,
      createdAt: profile.createdAt,
      hasPhoto: Boolean(profile.photoUrl),
      hasDriverLicense: documents.some((doc) => doc.ownerType === DocumentOwnerType.DRIVER && doc.type === DOCUMENT_TYPES.DRIVER_LICENSE),
      vehicleCount: vehicleIds.length,
      hasVehicleRegistration: documents.some((doc) => doc.ownerType === DocumentOwnerType.VEHICLE && doc.type === DOCUMENT_TYPES.VEHICLE_REGISTRATION),
      graceDays: await this.graceDays(),
      now,
    });
  }

  /** Lève une 403 claire quand ce conducteur ne peut plus créer de trajets. */
  async assertCanCreateTrips(driverProfileId: string): Promise<DriverCompliance> {
    const compliance = await this.evaluate(driverProfileId);
    if (!compliance.canCreateTrips) throw new ForbiddenException(compliance.blockedReason);
    return compliance;
  }
}
