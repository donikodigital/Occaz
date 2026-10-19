// backend/src/shipments/shipment-access.service.ts
// [19/10/2026] v1 — Contrôle d'accès aux PREUVES d'un envoi (photos de remise, pièces jointes) : GET/POST /shipments/:id/documents.
// Avant, n'importe quel compte connecté connaissant l'identifiant d'un envoi pouvait lire ou ajouter des pièces sur l'envoi d'un autre
// (faille « BOLA » : autorisation vérifiée sur la route, pas sur l'objet). Désormais : l'expéditeur, le conducteur de CET envoi, ou le
// personnel autorisé dans son périmètre pays. Les autres reçoivent 403 (ou 404 si l'envoi n'existe pas).
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

export type ShipmentAccessMode = 'read' | 'write';

@Injectable()
export class ShipmentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: CountryScopeService,
    private readonly customers: CustomerProfilesService,
    private readonly drivers: DriverProfilesService,
  ) {}

  /** Laisse passer l'expéditeur, le conducteur assigné ou le personnel autorisé ; lève une erreur pour tous les autres. */
  async assertCanAccessEvidence(user: AuthenticatedUser, shipmentId: string, mode: ShipmentAccessMode): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, customerId: true, driverId: true },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');

    // Personnel : lecture = shipment.read ; ajout = shipment.update. Dans les deux cas, l'envoi doit relever de son périmètre pays.
    const staffPermission = mode === 'read' ? PERMISSIONS.SHIPMENT_READ : PERMISSIONS.SHIPMENT_UPDATE;
    if (user.permissions?.includes(staffPermission)) {
      await this.scope.assertShipment(user, staffPermission, shipmentId);
      return;
    }

    const customer = await this.customers.findByUserId(user.id).catch(() => null);
    if (customer && customer.id === shipment.customerId) return;

    if (shipment.driverId) {
      const driverId = await this.drivers.getProfileIdForUser(user.id).catch(() => null);
      if (driverId && driverId === shipment.driverId) return;
    }
    throw new ForbiddenException('Cet envoi ne vous appartient pas.');
  }
}
