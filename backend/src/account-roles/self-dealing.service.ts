// backend/src/account-roles/self-dealing.service.ts
// [19/10/2026] v1 — Pas de transaction avec soi-même. Un compte qui a les deux profils (client et conducteur) ne doit pas pouvoir réserver son
// propre trajet, accepter l'envoi qu'il a lui-même passé, ni se noter : cela fabriquerait des paiements, des commissions, des gains et des
// avis fictifs. Les contrôles se font sur l'IDENTITÉ (le compte), pas sur le profil.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SelfDealingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Réserver un trajet dont on est le conducteur : refusé. */
  async assertNotOwnTrip(userId: string, tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, select: { driver: { select: { userId: true } } } });
    if (!trip) throw new NotFoundException('Trajet introuvable.');
    if (trip.driver.userId === userId) {
      throw new ForbiddenException('Vous ne pouvez pas réserver votre propre trajet.');
    }
  }

  /** Accepter (ou répondre à) un envoi dont on est l'expéditeur : refusé. */
  async assertNotOwnShipment(userId: string, shipmentId: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, select: { customer: { select: { userId: true } } } });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (shipment.customer.userId === userId) {
      throw new ForbiddenException('Vous ne pouvez pas transporter votre propre envoi.');
    }
  }

  /** Invitation reçue par un conducteur pour un envoi : même règle, à partir de l'identifiant de l'invitation. */
  async assertNotOwnInvitation(userId: string, invitationId: string): Promise<void> {
    const invitation = await this.prisma.shipmentInvitation.findUnique({
      where: { id: invitationId },
      select: { shipment: { select: { customer: { select: { userId: true } } } } },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable.');
    if (invitation.shipment.customer.userId === userId) {
      throw new ForbiddenException('Vous ne pouvez pas transporter votre propre envoi.');
    }
  }
}
