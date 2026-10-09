// backend/src/trips/trip-arrival.service.ts
//
// [09/10/2026] v1 — Ce qui part automatiquement quand le conducteur signale son arrivée quelque part (départ, ville traversée,
// destination). Avant, seuls les clients qui montent à une étape étaient prévenus (push + SMS, sans email), sans code ; ceux qui
// descendaient ne recevaient rien, et le code de dépose partait dès la prise en charge, pas à l'arrivée.
//
// Principe : à chaque arrivée, les clients concernés reçoivent EN MÊME TEMPS
//   - une notification (push + email) qui leur dit que le conducteur est là / qu'ils sont arrivés ;
//   - leur code (SMS + « Voir mon code » dans l'application) : prise en charge pour ceux qui montent ici, dépose pour ceux qui
//     descendent ici. Le SMS est celui du code (il porte déjà le message d'arrivée) : pas de second SMS de notification.
// Le conducteur n'a plus qu'à saisir le code que le client lui donne. Jamais envoyé au conducteur (règle d'or de OtpService).
//
// Qui reçoit quoi :
//   - départ        : prise en charge → clients qui montent au départ, pas encore pris en charge ;
//   - ville         : prise en charge → clients qui montent ici ; dépose → clients déjà à bord qui descendent ici ;
//   - destination   : dépose → tous les clients à bord dont la dépose n'est pas encore validée (y compris ceux dont l'étape de
//                     descente a été dépassée sans validation : un client n'est jamais coincé à l'arrivée).
// Un client jamais pris en charge (absent) ne reçoit pas de code de dépose : il n'est pas à bord. Son code reste obtenable
// (« Voir mon code », ou « Renvoyer le code » côté conducteur) si le conducteur l'a simplement oublié.
//
// [09/10/2026] v2 — À une ville traversée, l'arrivée peut se faire en deux temps (`audience`) : d'abord ceux qui DESCENDENT (code
// de dépose), puis, après leur dépose, « En route pour chercher X » → « Je suis arrivé sur les lieux » pour ceux qui MONTENT (code de
// prise en charge). Si personne ne descend dans la ville, un seul signal prévient ceux qui montent (audience « les deux »).
//
// Un échec d'envoi (SMS, email, push) n'empêche jamais le conducteur de signaler son arrivée : il est journalisé, et le code
// reste consultable dans l'application du client.
import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, NotificationChannel, NotificationType, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Qui prévenir à une ville traversée : ceux qui y descendent, ceux qui y montent, ou les deux (par défaut). */
export type StopAudience = 'ALIGHTING' | 'BOARDING' | 'BOTH';

/** Message de bon voyage envoyé au client une fois à bord et en route (voir announceDeparture / TripOtpService). */
export const BON_VOYAGE_TITLE = 'Bon voyage !';
export const BON_VOYAGE_BODY =
  "N'oubliez pas d'attacher votre ceinture de sécurité. Nous vous souhaitons un bon voyage.";

export type ArrivalPoint =
  | { kind: 'ORIGIN' }
  | { kind: 'STOP'; stopId: string; audience?: StopAudience }
  | { kind: 'DESTINATION' };

export interface ArrivalTrip {
  id: string;
  originCity: { name: string };
  destinationCity: { name: string };
}

type CodeKind = 'PICKUP' | 'DROPOFF';

interface ArrivalBooking {
  id: string;
  status: BookingStatus;
  boardingStopId: string | null;
  alightingStopId: string | null;
  passengers: Array<{ pickedUpAt: Date | null }>;
  customer: { userId: string; user: { phone: string } };
}

function isPickedUp(booking: Pick<ArrivalBooking, 'passengers'>): boolean {
  return booking.passengers.some((passenger) => Boolean(passenger.pickedUpAt));
}

@Injectable()
export class TripArrivalService {
  private readonly logger = new Logger(TripArrivalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * `placeName` : la ville où le conducteur vient d'arriver (départ, ville traversée ou destination), pour les messages.
   * À appeler une seule fois par arrivée (les transitions de TripsService refusent déjà un second signalement).
   */
  async announceArrival(trip: ArrivalTrip, point: ArrivalPoint, placeName: string): Promise<void> {
    const bookings = (await this.prisma.booking.findMany({
      where: { tripId: trip.id, status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
      select: {
        id: true,
        status: true,
        boardingStopId: true,
        alightingStopId: true,
        passengers: { select: { pickedUpAt: true } },
        customer: { select: { userId: true, user: { select: { phone: true } } } },
      },
    })) as ArrivalBooking[];

    const boarding = bookings.filter((booking) => {
      if (isPickedUp(booking)) return false;
      if (point.kind === 'ORIGIN') return !booking.boardingStopId;
      if (point.kind === 'STOP') return point.audience !== 'ALIGHTING' && booking.boardingStopId === point.stopId;
      return false;
    });
    const alighting = bookings.filter((booking) => {
      if (!isPickedUp(booking)) return false;
      if (point.kind === 'STOP') return point.audience !== 'BOARDING' && booking.alightingStopId === point.stopId;
      return point.kind === 'DESTINATION';
    });

    await Promise.all([
      ...boarding.map((booking) => this.notifyAndSendCode(trip, booking, 'PICKUP', point, placeName)),
      ...alighting.map((booking) => this.notifyAndSendCode(trip, booking, 'DROPOFF', point, placeName)),
    ]);
  }

  /**
   * Le conducteur démarre le trajet : chaque client déjà à bord reçoit son message de bon voyage (rappel de la ceinture de
   * sécurité). Notification seulement — pas d'email ni de SMS pour un simple rappel. Un client qui monte plus tard, en cours de
   * route, le reçoit à sa prise en charge (TripOtpService). Un échec d'envoi ne gêne jamais le départ.
   */
  async announceDeparture(tripId: string): Promise<void> {
    const bookings = (await this.prisma.booking.findMany({
      where: { tripId, status: BookingStatus.CONFIRMED, passengers: { some: { pickedUpAt: { not: null } } } },
      select: { id: true, customer: { select: { userId: true } } },
    })) as Array<{ id: string; customer: { userId: string } }>;

    await Promise.all(
      bookings.map(async (booking) => {
        try {
          await this.notifications.notify({
            userId: booking.customer.userId,
            type: NotificationType.STATUS_CHANGE,
            channels: [NotificationChannel.PUSH],
            fallbackTitle: BON_VOYAGE_TITLE,
            fallbackBody: BON_VOYAGE_BODY,
            pushData: { type: 'STATUS_CHANGE', tripId, bookingId: booking.id },
          });
        } catch (error) {
          this.logger.warn(`Départ : message de bon voyage non envoyé pour la réservation ${booking.id} — ${(error as Error).message}.`);
        }
      }),
    );
  }

  private async notifyAndSendCode(
    trip: ArrivalTrip,
    booking: ArrivalBooking,
    kind: CodeKind,
    point: ArrivalPoint,
    placeName: string,
  ): Promise<void> {
    const texts = this.textsFor(trip, kind, point, placeName);
    try {
      await Promise.all([
        this.notifications.notify({
          userId: booking.customer.userId,
          type: kind === 'PICKUP' ? NotificationType.DEPARTURE_IMMINENT : NotificationType.ARRIVAL,
          // Pas de SMS ici : celui du code (ci-dessous) dit déjà la même chose, avec le code.
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          fallbackTitle: texts.title,
          fallbackBody: texts.body,
          pushData: {
            type: kind === 'PICKUP' ? 'DEPARTURE_IMMINENT' : 'ARRIVAL',
            tripId: trip.id,
            bookingId: booking.id,
          },
        }),
        // Le code n'a de sens que pour une réservation confirmée (payée) : c'est aussi ce qu'exige la validation.
        booking.status === BookingStatus.CONFIRMED
          ? this.otp.generateAndSend(
              {
                purpose: kind === 'PICKUP' ? OtpPurpose.TRIP_PICKUP : OtpPurpose.TRIP_DROPOFF,
                phone: booking.customer.user.phone,
                bookingId: booking.id,
              },
              texts.sms,
            )
          : Promise.resolve(),
      ]);
    } catch (error) {
      this.logger.warn(
        `Arrivée (${kind}) : envoi impossible pour la réservation ${booking.id} — ${(error as Error).message}. Le code reste consultable dans l'application.`,
      );
    }
  }

  private textsFor(
    trip: ArrivalTrip,
    kind: CodeKind,
    point: ArrivalPoint,
    placeName: string,
  ): { title: string; body: string; sms: string } {
    if (kind === 'PICKUP') {
      const where =
        point.kind === 'ORIGIN'
          ? `Votre conducteur vous attend au point de départ de ${trip.originCity.name} → ${trip.destinationCity.name}.`
          : `Votre conducteur est arrivé à ${placeName}.`;
      return {
        title: 'Le conducteur est arrivé',
        body: `${where} Donnez-lui votre code de prise en charge (reçu par SMS, ou bouton « Voir mon code » dans l'application).`,
        sms:
          point.kind === 'ORIGIN'
            ? 'Votre conducteur est arrivé. Communiquez-lui ce code pour confirmer votre prise en charge :'
            : `Votre conducteur est arrivé à ${placeName}. Communiquez-lui ce code pour confirmer votre prise en charge :`,
      };
    }
    return {
      title: `Vous êtes arrivé à ${placeName}`,
      body: `Vous êtes arrivé à ${placeName}. Donnez votre code de dépose à votre conducteur pour confirmer la fin de votre trajet (reçu par SMS, ou bouton « Voir mon code » dans l'application).`,
      sms: `Vous êtes arrivé à ${placeName}. Communiquez ce code à votre conducteur pour confirmer la fin de votre trajet :`,
    };
  }
}
