// backend/src/profiles/driver-profiles/driver-compliance.service.spec.ts
// [19/10/2026] Régularisation d'un conducteur : trajets permis pendant le délai de tolérance, bloqués ensuite tant que des pièces manquent ;
// dossier complet en attente d'examen jamais bloqué ; colis réservés aux conducteurs validés.
import { DriverAccountStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { DriverComplianceService, computeCompliance, joinLabels } from './driver-compliance.service';

const DAY = 86_400_000;
const NOW = new Date('2026-10-19T12:00:00Z');
const created = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY);

const base = {
  status: DriverAccountStatus.PENDING,
  createdAt: created(1),
  hasPhoto: false,
  hasDriverLicense: false,
  vehicleCount: 0,
  hasVehicleRegistration: false,
  graceDays: 7,
  now: NOW,
};

describe('computeCompliance', () => {
  it('conducteur en attente, dossier vide, jour 1 : peut créer des trajets, pas de colis, 6 jours restants', () => {
    const result = computeCompliance(base);
    expect(result.canCreateTrips).toBe(true);
    expect(result.canCarryShipments).toBe(false);
    expect(result.daysLeft).toBe(6);
    expect(result.missing).toEqual(['photo', 'driver_license', 'vehicle', 'vehicle_registration']);
    expect(result.blockedReason).toBeNull();
  });

  it('au dernier jour il reste 1 jour ; l\'échéance exacte est encore permise', () => {
    expect(computeCompliance({ ...base, createdAt: created(6.5) }).daysLeft).toBe(1);
    expect(computeCompliance({ ...base, createdAt: created(7) }).canCreateTrips).toBe(true);
  });

  it('délai dépassé et pièces manquantes : création de trajets bloquée avec les pièces à envoyer', () => {
    const result = computeCompliance({ ...base, createdAt: created(8), hasPhoto: true });
    expect(result.graceExpired).toBe(true);
    expect(result.canCreateTrips).toBe(false);
    expect(result.daysLeft).toBe(0);
    expect(result.blockedReason).toContain('permis de conduire');
    expect(result.blockedReason).not.toContain('photo de profil');
  });

  it('délai dépassé mais dossier complet en attente d\'examen : jamais bloqué', () => {
    const result = computeCompliance({ ...base, createdAt: created(30), hasPhoto: true, hasDriverLicense: true, vehicleCount: 1, hasVehicleRegistration: true });
    expect(result.awaitingReview).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.canCreateTrips).toBe(true);
    expect(result.canCarryShipments).toBe(false);
  });

  it('conducteur validé : trajets et colis, quelle que soit l\'ancienneté', () => {
    const result = computeCompliance({ ...base, status: DriverAccountStatus.VALIDATED, createdAt: created(90) });
    expect(result.isCompliant).toBe(true);
    expect(result.canCreateTrips).toBe(true);
    expect(result.canCarryShipments).toBe(true);
  });

  it.each([DriverAccountStatus.SUSPENDED, DriverAccountStatus.BLOCKED, DriverAccountStatus.DEACTIVATED])('compte %s : aucun trajet', (status) => {
    const result = computeCompliance({ ...base, status });
    expect(result.canCreateTrips).toBe(false);
    expect(result.blockedReason).toContain('suspendu');
  });

  it('un délai à zéro n\'accorde aucune tolérance', () => {
    expect(computeCompliance({ ...base, graceDays: 0, createdAt: created(0.5) }).canCreateTrips).toBe(false);
  });

  it('joinLabels écrit une liste lisible', () => {
    expect(joinLabels([])).toBe('');
    expect(joinLabels(['a'])).toBe('a');
    expect(joinLabels(['a', 'b', 'c'])).toBe('a, b et c');
  });
});

describe('DriverComplianceService', () => {
  function build(options: { setting?: unknown; docs?: Array<{ ownerType: string; type: string }>; profile?: Record<string, unknown> | null } = {}) {
    const prisma = {
      platformSetting: { findUnique: jest.fn().mockResolvedValue(options.setting === undefined ? null : { value: options.setting }) },
      driverProfile: {
        findUnique: jest.fn().mockResolvedValue(
          options.profile === undefined
            ? { id: 'dp1', status: DriverAccountStatus.PENDING, createdAt: new Date(Date.now() - 10 * DAY), photoUrl: 'p.jpg', vehicles: [{ id: 'v1' }] }
            : options.profile,
        ),
      },
      document: { findMany: jest.fn().mockResolvedValue(options.docs ?? []) },
    };
    return { service: new DriverComplianceService(prisma as never), prisma };
  }

  it('lit le délai dans les réglages (7 jours par défaut)', async () => {
    expect(await build().service.graceDays()).toBe(7);
    expect(await build({ setting: 3 }).service.graceDays()).toBe(3);
    expect(await build({ setting: 'abc' }).service.graceDays()).toBe(7);
    expect(await build({ setting: -2 }).service.graceDays()).toBe(7);
  });

  it('un document refusé n\'est pas compté : seuls les documents en attente ou vérifiés comptent', async () => {
    const { service, prisma } = build({ docs: [{ ownerType: 'DRIVER', type: 'driver_license' }] });
    const result = await service.evaluate('dp1');
    expect(prisma.document.findMany.mock.calls[0][0].where.status.in).toEqual(['PENDING', 'VERIFIED']);
    expect(result.missing).toEqual(['vehicle_registration']);
  });

  it('assertCanCreateTrips : 403 une fois le délai dépassé avec des pièces manquantes', async () => {
    const { service } = build();
    await expect(service.assertCanCreateTrips('dp1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertCanCreateTrips : passe dans le délai', async () => {
    const { service } = build({ setting: 30 });
    await expect(service.assertCanCreateTrips('dp1')).resolves.toMatchObject({ canCreateTrips: true });
  });
});
