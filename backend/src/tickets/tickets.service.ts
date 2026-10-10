// backend/src/tickets/tickets.service.ts
// [10/10/2026] v1 — Billets de voyage et étiquettes de colis en PDF A5 : chargement des données, génération, envoi par e-mail à la
// confirmation du paiement (si le client a une adresse e-mail) et liens de téléchargement pour l'application.
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BookingStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { BookingPaidEvent, DOMAIN_EVENTS, ShipmentPaidEvent } from '../common/events/domain-events';
import { formatMoneyWithCurrency } from '../common/utils/money.util';
import { renderBookingTicket, type BookingTicketData } from './booking-ticket.pdf';
import { renderParcelLabels, type ParcelLabelData } from './parcel-label.pdf';
import {
  bookingQrPayload,
  bookingReference,
  createDownloadToken,
  formatTrackingNumber,
  parcelQrPayload,
  parcelTrackingNumber,
  readDownloadToken,
  shipmentTrackingNumber,
  type DownloadKind,
} from './ticket-codes';

export interface PdfFile {
  filename: string;
  buffer: Buffer;
}

/** Statuts d'une réservation pour lesquels un billet existe : payée, et pas annulée ni remboursée. */
const TICKET_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.DISPUTED,
];

/** Un envoi non payé, annulé ou remboursé n'a pas d'étiquette à coller. */
const NO_LABEL_STATUSES: ShipmentStatus[] = [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED, ShipmentStatus.REFUNDED];

const DEFAULT_TIME_ZONE = 'Africa/Conakry';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly customerProfiles: CustomerProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

  private get timeZone(): string {
    return process.env.TICKET_TIMEZONE || DEFAULT_TIME_ZONE;
  }

  // -----------------------------------------------------------------------
  // Liens de téléchargement
  // -----------------------------------------------------------------------

  /** Lien (chemin relatif à l'API) pour télécharger le billet d'une réservation — après vérification que la personne y a droit. */
  async bookingDownloadLink(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, customerId: true, status: true } });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    await this.assertAccess(user, booking.customerId, () => this.scope.hasBookingAccess(user, bookingId), 'Cette réservation ne vous appartient pas.');
    this.assertTicketStatus(booking.status);
    return this.linkFor('BOOKING', bookingId, `billet-${bookingReference(bookingId)}.pdf`);
  }

  /** Lien pour télécharger les étiquettes de tous les colis d'un envoi. */
  async shipmentDownloadLink(shipmentId: string, user: AuthenticatedUser) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, select: { id: true, customerId: true, status: true } });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    await this.assertAccess(user, shipment.customerId, () => this.scope.hasShipmentAccess(user, shipmentId), 'Cet envoi ne vous appartient pas.');
    this.assertLabelStatus(shipment.status);
    return this.linkFor('SHIPMENT', shipmentId, `etiquettes-${shipmentTrackingNumber(shipmentId)}.pdf`);
  }

  private linkFor(kind: DownloadKind, id: string, filename: string) {
    const { token, expiresAt } = createDownloadToken(kind, id);
    return { path: `tickets/download/${token}`, filename, expiresAt };
  }

  /** Document correspondant à un jeton de lien (ouvert sans connexion : la validité du jeton tient lieu d'autorisation). */
  async fileForToken(token: string): Promise<PdfFile> {
    const target = readDownloadToken(token);
    if (!target) throw new ForbiddenException('Lien invalide ou expiré. Demandez-en un nouveau depuis l\'application.');
    return target.kind === 'BOOKING' ? this.bookingTicketPdf(target.id) : this.shipmentLabelsPdf(target.id);
  }

  private async assertAccess(
    user: AuthenticatedUser,
    ownerCustomerId: string,
    hasStaffAccess: () => Promise<boolean>,
    message: string,
  ): Promise<void> {
    const customer = await this.customerProfiles.findByUserId(user.id).catch(() => null);
    if (customer && customer.id === ownerCustomerId) return;
    if (await hasStaffAccess()) return;
    throw new ForbiddenException(message);
  }

  private assertTicketStatus(status: BookingStatus): void {
    if (!TICKET_STATUSES.includes(status)) {
      throw new BadRequestException('Le billet est disponible une fois la réservation payée (et tant qu\'elle n\'est pas annulée).');
    }
  }

  private assertLabelStatus(status: ShipmentStatus): void {
    if (NO_LABEL_STATUSES.includes(status)) {
      throw new BadRequestException('Les étiquettes sont disponibles une fois l\'envoi payé (et tant qu\'il n\'est pas annulé).');
    }
  }

  // -----------------------------------------------------------------------
  // Billet de voyage
  // -----------------------------------------------------------------------

  /** Données imprimées sur le billet d'une réservation, avec l'adresse e-mail du client (pour l'envoi). */
  async loadBookingTicket(bookingId: string): Promise<{ data: BookingTicketData; email: string | null; firstName: string; status: BookingStatus }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: {
          include: {
            originCity: true,
            destinationCity: true,
            originLocation: true,
            destinationLocation: true,
            driver: { select: { firstName: true, lastName: true } },
            vehicle: { select: { brand: true, model: true, color: true, plateNumber: true } },
          },
        },
        customer: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
        passengers: true,
        boardingStop: { include: { location: true, city: true } },
        alightingStop: { include: { location: true, city: true } },
        currency: true,
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');

    const { trip } = booking;
    const boarding = booking.boardingStop;
    const alighting = booking.alightingStop;

    // Montée à une étape : l'heure de passage n'est imprimée que si le conducteur l'a estimée ; sinon, seule la date du trajet.
    const boardingEstimate = boarding ? boarding.estimatedArrivalAt : trip.departureAt;
    const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`.trim();
    const passengerNames = booking.passengers.map((passenger) => passenger.fullName.trim()).filter(Boolean);
    const vehicle = trip.vehicle
      ? `${trip.vehicle.brand} ${trip.vehicle.model}${trip.vehicle.color ? ` ${trip.vehicle.color}` : ''} · ${trip.vehicle.plateNumber}`
      : null;

    const data: BookingTicketData = {
      reference: bookingReference(booking.id),
      qrPayload: bookingQrPayload(booking.id),
      timeZone: this.timeZone,
      departureAt: boardingEstimate ?? trip.departureAt,
      boardingTimeKnown: Boolean(boardingEstimate),
      originCity: boarding?.city?.name ?? trip.originCity.name,
      originPlace: boarding?.location?.label ?? trip.originLocation?.label ?? null,
      destinationCity: alighting?.city?.name ?? trip.destinationCity.name,
      destinationPlace: alighting?.location?.label ?? trip.destinationLocation?.label ?? null,
      arrivalAt: alighting?.estimatedArrivalAt ?? null,
      passengers: passengerNames.length > 0 ? passengerNames : [customerName],
      seatsCount: booking.seatsCount,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`.trim(),
      vehicle,
      amountPaid: formatMoneyWithCurrency(booking.totalAmount, booking.currency.isoCode),
      bookedAt: booking.createdAt,
    };
    return { data, email: booking.customer.user?.email ?? null, firstName: booking.customer.firstName, status: booking.status };
  }

  /** PDF du billet (sans contrôle d'accès : l'appelant l'a fait, ou le jeton de lien en tient lieu). */
  async bookingTicketPdf(bookingId: string): Promise<PdfFile> {
    const { data, status } = await this.loadBookingTicket(bookingId);
    this.assertTicketStatus(status);
    return { filename: `billet-${data.reference}.pdf`, buffer: await renderBookingTicket(data) };
  }

  // -----------------------------------------------------------------------
  // Étiquettes de colis
  // -----------------------------------------------------------------------

  async loadParcelLabels(shipmentId: string): Promise<{ labels: ParcelLabelData[]; email: string | null; firstName: string; status: ShipmentStatus }> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        category: true,
        currency: true,
        items: { orderBy: { createdAt: 'asc' } },
        senderLocation: { include: { city: { include: { country: true } } } },
        recipientLocation: { include: { city: { include: { country: true } } } },
        customer: { select: { firstName: true, user: { select: { email: true } } } },
      },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');

    const isoCode = shipment.currency.isoCode;
    const senderCity = shipment.senderLocation.city;
    const recipientLocation = shipment.recipientLocation;
    const recipientAddress =
      recipientLocation.formattedAddress && recipientLocation.formattedAddress.length > recipientLocation.label.length
        ? recipientLocation.formattedAddress
        : recipientLocation.label;

    const dimensionsOf = (parcel: { lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null }): string | null =>
      parcel.lengthCm && parcel.widthCm && parcel.heightCm ? `${parcel.lengthCm} × ${parcel.widthCm} × ${parcel.heightCm}` : null;
    const moneyOrNull = (amount: bigint | null | undefined): string | null =>
      amount && amount > 0n ? formatMoneyWithCurrency(amount, isoCode) : null;

    // Envoi saisi colis par colis : une étiquette par ShipmentItem, avec SES mesures. Ancien envoi : autant d'étiquettes que de colis
    // (quantité), poids moyen — le détail de chacun n'a jamais été saisi.
    type ParcelSource = { weightKg: number | null; dimensions: string | null; declaredValue: string | null; description: string | null };
    const sources: ParcelSource[] =
      shipment.items.length > 0
        ? shipment.items.map((item) => ({
            weightKg: item.weightKg ?? null,
            dimensions: dimensionsOf(item),
            declaredValue: moneyOrNull(item.declaredValue),
            description: item.description ?? null,
          }))
        : Array.from({ length: Math.max(1, shipment.quantity) }, () => ({
            weightKg: Math.round((shipment.weightKg / Math.max(1, shipment.quantity)) * 100) / 100,
            dimensions: dimensionsOf(shipment),
            declaredValue: shipment.quantity === 1 ? moneyOrNull(shipment.declaredValue) : null,
            description: shipment.description ?? null,
          }));

    const labels = sources.map(
      (source, index): ParcelLabelData => ({
        trackingNumber: parcelTrackingNumber(shipment.id, index + 1),
        displayTracking: formatTrackingNumber(shipmentTrackingNumber(shipment.id)),
        parcelNumber: index + 1,
        parcelCount: sources.length,
        qrPayload: parcelQrPayload(shipment.id, index + 1),
        isUrgent: shipment.isUrgent,
        senderName: shipment.senderName,
        senderPlace: [senderCity?.name, senderCity?.country?.name].filter(Boolean).join(', ') || shipment.senderLocation.label,
        recipientName: shipment.recipientName,
        recipientPhone: shipment.recipientPhone,
        recipientAddress,
        recipientCity: recipientLocation.city?.name ?? recipientLocation.label,
        recipientCountry: recipientLocation.city?.country?.name ?? null,
        weightKg: source.weightKg,
        dimensions: source.dimensions,
        declaredValue: source.declaredValue,
        description: source.description,
        category: shipment.category.name,
        windowEnd: shipment.windowEnd,
        timeZone: this.timeZone,
      }),
    );
    return { labels, email: shipment.customer.user?.email ?? null, firstName: shipment.customer.firstName, status: shipment.status };
  }

  async shipmentLabelsPdf(shipmentId: string): Promise<PdfFile> {
    const { labels, status } = await this.loadParcelLabels(shipmentId);
    this.assertLabelStatus(status);
    const tracking = shipmentTrackingNumber(shipmentId);
    return { filename: `etiquettes-${tracking}.pdf`, buffer: await renderParcelLabels({ title: `Étiquettes ${tracking}`, labels }) };
  }

  // -----------------------------------------------------------------------
  // E-mail à la confirmation du paiement
  // -----------------------------------------------------------------------

  @OnEvent(DOMAIN_EVENTS.BOOKING_PAID, { async: true })
  async onBookingPaid(event: BookingPaidEvent): Promise<void> {
    try {
      await this.emailBookingTicket(event.bookingId);
    } catch (error) {
      // Un e-mail qui échoue ne doit jamais toucher au paiement : le billet reste téléchargeable dans l'application.
      this.logger.warn(`Billet de la réservation ${event.bookingId} non envoyé par e-mail : ${(error as Error).message}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.SHIPMENT_PAID, { async: true })
  async onShipmentPaid(event: ShipmentPaidEvent): Promise<void> {
    try {
      await this.emailShipmentLabels(event.shipmentId);
    } catch (error) {
      this.logger.warn(`Étiquettes de l'envoi ${event.shipmentId} non envoyées par e-mail : ${(error as Error).message}`);
    }
  }

  /** Envoie le billet par e-mail si le client a une adresse. Renvoie false (sans erreur) quand il n'en a pas. */
  async emailBookingTicket(bookingId: string): Promise<boolean> {
    const { data, email, firstName, status } = await this.loadBookingTicket(bookingId);
    if (!email) return false;
    this.assertTicketStatus(status);

    const buffer = await renderBookingTicket(data);
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: data.timeZone }).format(data.departureAt);
    const time = data.boardingTimeKnown
      ? ` à ${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: data.timeZone }).format(data.departureAt)}`
      : '';
    await this.emailProvider.send(
      email,
      `Votre billet Occa'Z · ${data.originCity} → ${data.destinationCity}`,
      [
        `Bonjour ${firstName},`,
        '',
        `Votre réservation est confirmée. Votre billet (PDF, format A5) est en pièce jointe : gardez-le sur votre téléphone ou imprimez-le.`,
        '',
        `Trajet : ${data.originCity} → ${data.destinationCity}`,
        `Départ : ${day}${time}`,
        `Places : ${data.seatsCount}`,
        `Référence : ${data.reference}`,
        '',
        `Le code de prise en charge à 6 chiffres vous sera envoyé quand le conducteur arrivera. Ne le donnez qu'au conducteur.`,
      ].join('\n'),
      undefined,
      [{ filename: `billet-${data.reference}.pdf`, content: buffer, contentType: 'application/pdf' }],
    );
    return true;
  }

  /** Envoie les étiquettes par e-mail si le client a une adresse. Renvoie false (sans erreur) quand il n'en a pas. */
  async emailShipmentLabels(shipmentId: string): Promise<boolean> {
    const { labels, email, firstName, status } = await this.loadParcelLabels(shipmentId);
    if (!email) return false;
    this.assertLabelStatus(status);

    const tracking = shipmentTrackingNumber(shipmentId);
    const buffer = await renderParcelLabels({ title: `Étiquettes ${tracking}`, labels });
    const count = labels.length;
    await this.emailProvider.send(
      email,
      `Vos étiquettes de colis Occa'Z · ${labels[0].recipientCity}`,
      [
        `Bonjour ${firstName},`,
        '',
        `Votre paiement est confirmé. ${count > 1 ? `Les ${count} étiquettes de vos colis sont` : "L'étiquette de votre colis est"} en pièce jointe (PDF, une page A5 par colis).`,
        '',
        `Imprimez-${count > 1 ? 'les' : 'la'} et collez ${count > 1 ? 'chaque étiquette sur le colis correspondant (1/' + count + ', 2/' + count + '…)' : "l'étiquette sur le colis"}, bien visible, sans cacher le code-barres. Cela évite de mélanger les colis lorsque le conducteur en transporte plusieurs.`,
        '',
        `Numéro de suivi : ${formatTrackingNumber(tracking)}`,
        `Destinataire : ${labels[0].recipientName} · ${labels[0].recipientCity}`,
      ].join('\n'),
      undefined,
      [{ filename: `etiquettes-${tracking}.pdf`, content: buffer, contentType: 'application/pdf' }],
    );
    return true;
  }
}
