// backend/src/vehicles/vehicles.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentOwnerType, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDocumentDto } from '../documents/dto/create-document.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documentsService: DocumentsService,
  ) {}

  findAllForDriver(driverId: string) {
    return this.prisma.vehicle.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable.');
    return vehicle;
  }

  /** Lève une exception si `driverId` n'est pas propriétaire du véhicule `id`. */
  async assertOwnership(id: string, driverId: string) {
    const vehicle = await this.findOne(id);
    if (vehicle.driverId !== driverId) {
      throw new ForbiddenException("Ce véhicule n'appartient pas à ce chauffeur.");
    }
    return vehicle;
  }

  create(driverId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        driverId,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        plateNumber: dto.plateNumber.toUpperCase(),
        type: dto.type,
        totalSeats: dto.totalSeats,
        photoUrl: dto.photoUrl,
        verificationStatus: DocumentStatus.PENDING,
      },
    });
  }

  async update(id: string, driverId: string, dto: UpdateVehicleDto) {
    await this.assertOwnership(id, driverId);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: string, driverId: string) {
    await this.assertOwnership(id, driverId);
    await this.prisma.vehicle.delete({ where: { id } }); // soft delete (middleware)
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { verificationStatus?: DocumentStatus; driverId?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      verificationStatus: filters.verificationStatus,
      driverId: filters.driverId,
      ...(query.search
        ? {
            OR: [
              { brand: { contains: query.search, mode: 'insensitive' as const } },
              { model: { contains: query.search, mode: 'insensitive' as const } },
              { plateNumber: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async verify(id: string, actorId: string) {
    await this.findOne(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { verificationStatus: DocumentStatus.VERIFIED },
    });
    await this.audit.log({
      actorId,
      entityType: 'Vehicle',
      entityId: id,
      action: 'VERIFY',
    });
    return vehicle;
  }

  async reject(id: string, actorId: string) {
    await this.findOne(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { verificationStatus: DocumentStatus.REJECTED },
    });
    await this.audit.log({
      actorId,
      entityType: 'Vehicle',
      entityId: id,
      action: 'REJECT',
    });
    return vehicle;
  }

  // -----------------------------------------------------------------------
  // Documents du véhicule (carte grise, assurance...) — délègue au service
  // générique après vérification de propriété.
  // -----------------------------------------------------------------------

  async uploadDocument(vehicleId: string, driverId: string, dto: CreateDocumentDto) {
    await this.assertOwnership(vehicleId, driverId);
    return this.documentsService.create(DocumentOwnerType.VEHICLE, vehicleId, dto);
  }

  findDocuments(vehicleId: string) {
    return this.documentsService.findAllForOwner(DocumentOwnerType.VEHICLE, vehicleId);
  }
}
