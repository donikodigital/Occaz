// backend/src/common/scope/country-scope.service.ts
//
// Applique la portée géographique des rôles (voir country-scope.ts pour les règles) :
//  - les méthodes `…Where(user, permission)` donnent le filtre Prisma à ajouter à une liste
//    (undefined = aucune restriction, comportement historique) ;
//  - les méthodes `assert…` refusent (404, pour ne pas révéler l'existence du dossier) l'accès à un dossier
//    hors du périmètre de l'acteur ;
//  - les méthodes `has…Access` répondent par un booléen pour les contrôleurs qui mélangent accès « support »
//    et accès « partie au dossier ».
// Aucun effet pour un compte sans rôle limité à un pays (donc pour tous les comptes tant qu'on n'en crée pas).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, DocumentOwnerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS, PermissionKey } from '../constants/permissions.constants';
import { AuthenticatedUser } from '../types/request-with-user.interface';
import {
  CountryScope,
  bookingScopeWhere,
  conversationScopeWhere,
  customerScopeWhere,
  disputeScopeWhere,
  driverScopeWhere,
  payoutScopeWhere,
  scopeOf,
  shipmentScopeWhere,
  tripScopeWhere,
  userScopeWhere,
  vehicleScopeWhere,
  verificationScopeWhere,
  walletScopeWhere,
} from './country-scope';

type Actor = Pick<AuthenticatedUser, 'accountType' | 'countryScopes'>;
type ActorWithPermissions = Actor & Pick<AuthenticatedUser, 'permissions'>;

/** Collecte tous les `countryId` d'un objet imbriqué (résultat d'un `select` sur les relations d'un dossier). */
function collectCountryIds(node: unknown, found: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'countryId' && typeof value === 'string') found.add(value);
    else collectCountryIds(value, found);
  }
}

const COUNTRY_OF_CITY = { select: { countryId: true } } as const;
const PARTY_COUNTRIES = {
  customer: { select: { countryId: true, city: COUNTRY_OF_CITY } },
  driver: { select: { countryId: true } },
} as const;
const TRIP_COUNTRIES = {
  select: { originCity: COUNTRY_OF_CITY, destinationCity: COUNTRY_OF_CITY, driver: { select: { countryId: true } } },
} as const;

@Injectable()
export class CountryScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Portée de l'acteur pour une permission (null = aucune restriction). */
  scope(actor: Actor, permission: PermissionKey): CountryScope {
    return scopeOf(actor, permission);
  }

  // -------------------------------------------------------------------------
  // Filtres pour les listes (undefined = pas de restriction)
  // -------------------------------------------------------------------------

  customerWhere(actor: Actor, permission: PermissionKey): Prisma.CustomerProfileWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? customerScopeWhere(ids) : undefined;
  }

  driverWhere(actor: Actor, permission: PermissionKey): Prisma.DriverProfileWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? driverScopeWhere(ids) : undefined;
  }

  userWhere(actor: Actor, permission: PermissionKey): Prisma.UserWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? userScopeWhere(ids) : undefined;
  }

  /**
   * Filtre de la liste des utilisateurs : clients et chauffeurs du pays, plus les comptes d'équipe (sans pays,
   * nécessaires par exemple pour choisir un agent à qui assigner un litige — leur visibilité est réglée par
   * UsersService.visibleAccountTypes).
   */
  userListWhere(actor: Actor, permission: PermissionKey): Prisma.UserWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids
      ? { OR: [{ accountType: { in: [AccountType.SUPPORT, AccountType.SUPERADMIN] } }, userScopeWhere(ids)] }
      : undefined;
  }

  vehicleWhere(actor: Actor, permission: PermissionKey): Prisma.VehicleWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? vehicleScopeWhere(ids) : undefined;
  }

  tripWhere(actor: Actor, permission: PermissionKey): Prisma.TripWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? tripScopeWhere(ids) : undefined;
  }

  bookingWhere(actor: Actor, permission: PermissionKey): Prisma.BookingWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? bookingScopeWhere(ids) : undefined;
  }

  shipmentWhere(actor: Actor, permission: PermissionKey): Prisma.ShipmentWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? shipmentScopeWhere(ids) : undefined;
  }

  disputeWhere(actor: Actor, permission: PermissionKey): Prisma.DisputeWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? disputeScopeWhere(ids) : undefined;
  }

  verificationWhere(actor: Actor, permission: PermissionKey): Prisma.VerificationWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? verificationScopeWhere(ids) : undefined;
  }

  payoutWhere(actor: Actor, permission: PermissionKey): Prisma.PayoutWhereInput | undefined {
    const ids = scopeOf(actor, permission);
    return ids ? payoutScopeWhere(ids) : undefined;
  }

  // -------------------------------------------------------------------------
  // Contrôles d'accès à un dossier (404 hors périmètre)
  // -------------------------------------------------------------------------

  private async mustExist(count: Promise<number>, message: string): Promise<void> {
    if ((await count) === 0) throw new NotFoundException(message);
  }

  /** Compte client/chauffeur du pays. Les comptes d'équipe n'ont pas de pays : leur gestion suit d'autres règles (UsersService). */
  async assertUser(actor: Actor, permission: PermissionKey, userId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.user.count({
        where: {
          id: userId,
          OR: [{ accountType: { in: [AccountType.SUPPORT, AccountType.SUPERADMIN] } }, userScopeWhere(ids)],
        },
      }),
      'Utilisateur introuvable.',
    );
  }

  async assertCustomer(actor: Actor, permission: PermissionKey, customerId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.customerProfile.count({ where: { id: customerId, ...customerScopeWhere(ids) } }),
      'Client introuvable.',
    );
  }

  async assertDriver(actor: Actor, permission: PermissionKey, driverId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.driverProfile.count({ where: { id: driverId, ...driverScopeWhere(ids) } }),
      'Chauffeur introuvable.',
    );
  }

  async assertVehicle(actor: Actor, permission: PermissionKey, vehicleId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.vehicle.count({ where: { id: vehicleId, ...vehicleScopeWhere(ids) } }),
      'Véhicule introuvable.',
    );
  }

  async assertBooking(actor: Actor, permission: PermissionKey, bookingId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.booking.count({ where: { id: bookingId, ...bookingScopeWhere(ids) } }),
      'Réservation introuvable.',
    );
  }

  async assertShipment(actor: Actor, permission: PermissionKey, shipmentId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.shipment.count({ where: { id: shipmentId, ...shipmentScopeWhere(ids) } }),
      'Envoi introuvable.',
    );
  }

  async assertTrip(actor: Actor, permission: PermissionKey, tripId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.trip.count({ where: { id: tripId, ...tripScopeWhere(ids) } }),
      'Trajet introuvable.',
    );
  }

  async assertDispute(actor: Actor, permission: PermissionKey, disputeId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.dispute.count({ where: { id: disputeId, ...disputeScopeWhere(ids) } }),
      'Litige introuvable.',
    );
  }

  async assertVerification(actor: Actor, permission: PermissionKey, verificationId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.verification.count({ where: { id: verificationId, ...verificationScopeWhere(ids) } }),
      'Vérification introuvable.',
    );
  }

  async assertWallet(actor: Actor, permission: PermissionKey, walletId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.wallet.count({ where: { id: walletId, ...walletScopeWhere(ids) } }),
      'Portefeuille introuvable.',
    );
  }

  async assertPayout(actor: Actor, permission: PermissionKey, payoutId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    await this.mustExist(
      this.prisma.payout.count({ where: { id: payoutId, ...payoutScopeWhere(ids) } }),
      'Retrait introuvable.',
    );
  }

  /** Le propriétaire d'un document (chauffeur, véhicule, client, litige, envoi) relève-t-il du périmètre ? */
  private async ownerInScope(ownerType: DocumentOwnerType, ownerId: string, ids: string[]): Promise<boolean> {
    switch (ownerType) {
      case DocumentOwnerType.DRIVER:
        return (await this.prisma.driverProfile.count({ where: { id: ownerId, ...driverScopeWhere(ids) } })) > 0;
      case DocumentOwnerType.VEHICLE:
        return (await this.prisma.vehicle.count({ where: { id: ownerId, ...vehicleScopeWhere(ids) } })) > 0;
      case DocumentOwnerType.CUSTOMER:
        return (await this.prisma.customerProfile.count({ where: { id: ownerId, ...customerScopeWhere(ids) } })) > 0;
      case DocumentOwnerType.DISPUTE:
        return (await this.prisma.dispute.count({ where: { id: ownerId, ...disputeScopeWhere(ids) } })) > 0;
      case DocumentOwnerType.SHIPMENT:
        return (await this.prisma.shipment.count({ where: { id: ownerId, ...shipmentScopeWhere(ids) } })) > 0;
      default:
        return false;
    }
  }

  async assertDocumentOwner(
    actor: Actor,
    permission: PermissionKey,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    if (!(await this.ownerInScope(ownerType, ownerId, ids))) throw new NotFoundException('Document introuvable.');
  }

  async assertDocument(actor: Actor, permission: PermissionKey, documentId: string): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { ownerType: true, ownerId: true },
    });
    if (!document || !(await this.ownerInScope(document.ownerType, document.ownerId, ids))) {
      throw new NotFoundException('Document introuvable.');
    }
  }

  /**
   * Une liste de documents sans propriétaire précisé ne peut pas être filtrée proprement par pays (le
   * propriétaire est polymorphe) : un agent limité doit donc cibler un propriétaire — c'est ce que fait le
   * back-office depuis les fiches chauffeur et véhicule.
   */
  async assertDocumentListAllowed(
    actor: Actor,
    permission: PermissionKey,
    filters: { ownerType?: DocumentOwnerType; ownerId?: string },
  ): Promise<void> {
    const ids = scopeOf(actor, permission);
    if (!ids) return;
    if (!filters.ownerType || !filters.ownerId) {
      throw new BadRequestException(
        'Votre accès est limité à un pays : précisez ownerType et ownerId pour lister des documents.',
      );
    }
    await this.assertDocumentOwner(actor, permission, filters.ownerType, filters.ownerId);
  }

  /** Garde uniquement les documents dont le propriétaire relève du périmètre (petites listes : expirations). */
  async filterDocuments<T extends { ownerType: DocumentOwnerType; ownerId: string }>(
    actor: Actor,
    permission: PermissionKey,
    documents: T[],
  ): Promise<T[]> {
    const ids = scopeOf(actor, permission);
    if (!ids) return documents;
    const verdicts = new Map<string, boolean>();
    for (const document of documents) {
      const key = `${document.ownerType}:${document.ownerId}`;
      if (!verdicts.has(key)) verdicts.set(key, await this.ownerInScope(document.ownerType, document.ownerId, ids));
    }
    return documents.filter((document) => verdicts.get(`${document.ownerType}:${document.ownerId}`));
  }

  // -------------------------------------------------------------------------
  // Booléens pour les accès « support » mélangés aux accès « partie au dossier »
  // -------------------------------------------------------------------------

  /** Vrai si l'acteur a la permission de lecture des litiges ET que ce litige relève de son périmètre. */
  async hasDisputeAccess(actor: ActorWithPermissions, disputeId: string): Promise<boolean> {
    if (!actor.permissions.includes(PERMISSIONS.DISPUTE_READ)) return false;
    const ids = scopeOf(actor, PERMISSIONS.DISPUTE_READ);
    if (!ids) return true;
    return (await this.prisma.dispute.count({ where: { id: disputeId, ...disputeScopeWhere(ids) } })) > 0;
  }

  /** Lecture « support » d'une réservation : permission booking.read ET réservation dans le périmètre. */
  async hasBookingAccess(actor: ActorWithPermissions, bookingId: string): Promise<boolean> {
    if (!actor.permissions.includes(PERMISSIONS.BOOKING_READ)) return false;
    const ids = scopeOf(actor, PERMISSIONS.BOOKING_READ);
    if (!ids) return true;
    return (await this.prisma.booking.count({ where: { id: bookingId, ...bookingScopeWhere(ids) } })) > 0;
  }

  /** Lecture « support » d'un envoi : permission shipment.read ET envoi dans le périmètre. */
  async hasShipmentAccess(actor: ActorWithPermissions, shipmentId: string): Promise<boolean> {
    if (!actor.permissions.includes(PERMISSIONS.SHIPMENT_READ)) return false;
    const ids = scopeOf(actor, PERMISSIONS.SHIPMENT_READ);
    if (!ids) return true;
    return (await this.prisma.shipment.count({ where: { id: shipmentId, ...shipmentScopeWhere(ids) } })) > 0;
  }

  /** Lecture « support » des réservations d'un trajet : booking.read ET trajet dans le périmètre. */
  async hasTripBookingsAccess(actor: ActorWithPermissions, tripId: string): Promise<boolean> {
    if (!actor.permissions.includes(PERMISSIONS.BOOKING_READ)) return false;
    const ids = scopeOf(actor, PERMISSIONS.BOOKING_READ);
    if (!ids) return true;
    return (await this.prisma.trip.count({ where: { id: tripId, ...tripScopeWhere(ids) } })) > 0;
  }

  /** Idem pour la lecture des conversations (modération support). */
  async hasConversationAccess(actor: ActorWithPermissions, conversationId: string): Promise<boolean> {
    if (!actor.permissions.includes(PERMISSIONS.CONVERSATION_READ)) return false;
    const ids = scopeOf(actor, PERMISSIONS.CONVERSATION_READ);
    if (!ids) return true;
    return (
      (await this.prisma.conversation.count({ where: { id: conversationId, ...conversationScopeWhere(ids) } })) > 0
    );
  }

  // -------------------------------------------------------------------------
  // Divers
  // -------------------------------------------------------------------------

  /** Pays rattachés à un litige (parties, trajet, adresses) — sert à n'alerter que les agents concernés. */
  async countriesOfDispute(disputeId: string): Promise<string[]> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        booking: { select: { ...PARTY_COUNTRIES, trip: TRIP_COUNTRIES } },
        shipment: {
          select: {
            ...PARTY_COUNTRIES,
            trip: TRIP_COUNTRIES,
            senderLocation: { select: { city: COUNTRY_OF_CITY } },
            recipientLocation: { select: { city: COUNTRY_OF_CITY } },
          },
        },
      },
    });
    const found = new Set<string>();
    collectCountryIds(dispute, found);
    return Array.from(found);
  }

  /** Pays auxquels le compte est limité (pour l'afficher dans le back-office). Vide = aucune limite. */
  async describeScope(actor: Actor & Pick<AuthenticatedUser, 'scopedCountryIds'>): Promise<{ id: string; name: string }[]> {
    if (actor.accountType === AccountType.SUPERADMIN) return [];
    const ids = Object.values(actor.countryScopes ?? {}).flat();
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return [];
    return this.prisma.country.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}