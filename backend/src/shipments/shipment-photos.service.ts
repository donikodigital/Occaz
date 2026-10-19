// backend/src/shipments/shipment-photos.service.ts
// [19/10/2026] v1 — Photos du colis : URL d'envoi signée (expéditeur) et lecture (expéditeur, conducteur, personnel).
//
// Qui peut VOIR les photos d'un envoi :
//   • l'expéditeur, le conducteur de l'envoi et le personnel autorisé dans son périmètre pays (même règle que les preuves : ShipmentAccessService) ;
//   • un conducteur validé tant que l'envoi est ouvert aux candidatures (SEARCHING_DRIVER) : il voit la photo du colis avant d'accepter,
//     comme il en voit déjà les dimensions et le poids ;
//   • un conducteur invité par le client pour cet envoi.
// Tous les autres : 403. Les fichiers restent privés : le serveur renvoie des URL signées valables 5 minutes.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DocumentOwnerType, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { extensionForContentType } from '../storage/dto/request-upload-url.dto';
import { ShipmentAccessService } from './shipment-access.service';
import { ShipmentsService } from './shipments.service';
import { RequestParcelPhotoUploadDto } from './dto/request-parcel-photo-upload.dto';
import { PARCEL_PHOTO_FOLDER, PARCEL_PHOTO_TYPE } from './shipment-photos.util';

export interface ParcelPhotoView {
  id: string;
  url: string;
  expiresInSeconds: number;
}

@Injectable()
export class ShipmentPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly customers: CustomerProfilesService,
    private readonly access: ShipmentAccessService,
    private readonly shipments: ShipmentsService,
  ) {}

  /** Étape 1 (avant la création de l'envoi) : URL signée où le téléphone dépose la photo, dans un dossier au nom du client. */
  async requestUploadUrl(userId: string, dto: RequestParcelPhotoUploadDto) {
    const customer = await this.customers.findByUserId(userId);
    const storageKey = this.storage.buildKey(PARCEL_PHOTO_FOLDER, customer.id, extensionForContentType(dto.contentType));
    const { uploadUrl, expiresInSeconds } = await this.storage.createUploadUrl(storageKey, dto.contentType);
    return { storageKey, uploadUrl, expiresInSeconds };
  }

  /** Photos de l'envoi (2 au plus), de la plus ancienne à la plus récente, avec des URL signées de 5 minutes. */
  async list(user: AuthenticatedUser, shipmentId: string): Promise<ParcelPhotoView[]> {
    await this.assertCanView(user, shipmentId);
    const documents = await this.prisma.document.findMany({
      where: { ownerType: DocumentOwnerType.SHIPMENT, ownerId: shipmentId, type: PARCEL_PHOTO_TYPE, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storageKey: true },
    });
    return Promise.all(
      documents.map(async (document) => ({
        id: document.id,
        url: await this.storage.createDownloadUrl(document.storageKey),
        expiresInSeconds: 300,
      })),
    );
  }

  async assertCanView(user: AuthenticatedUser, shipmentId: string): Promise<void> {
    try {
      await this.access.assertCanAccessEvidence(user, shipmentId, 'read');
      return;
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error; // 404 : l'envoi n'existe pas
    }

    // Conducteur validé : envoi ouvert aux candidatures, ou invitation reçue pour cet envoi.
    const driverId = await this.shipments.requireEligibleDriver(user.id).catch(() => null);
    if (driverId) {
      const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, select: { status: true } });
      if (shipment?.status === ShipmentStatus.SEARCHING_DRIVER) return;
      const invitation = await this.prisma.shipmentInvitation.findUnique({
        where: { shipmentId_driverId: { shipmentId, driverId } },
        select: { id: true },
      });
      if (invitation) return;
    }
    throw new ForbiddenException('Cet envoi ne vous appartient pas.');
  }
}
