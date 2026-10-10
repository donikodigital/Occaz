// backend/src/user-safety/emergency-contacts.service.ts
// [11/10/2026] v1 — les proches prévenus par SMS lors d'un SOS (3 au plus par compte).
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmergencyContactDto } from './dto/user-safety.dto';

export const MAX_EMERGENCY_CONTACTS = 3;

@Injectable()
export class EmergencyContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, createdAt: true },
    });
  }

  async add(userId: string, dto: CreateEmergencyContactDto) {
    const [owner, count] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
      this.prisma.emergencyContact.count({ where: { userId } }),
    ]);
    if (owner && owner.phone === dto.phone) {
      throw new BadRequestException('Choisissez le numéro d’un proche, pas le vôtre.');
    }
    if (count >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestException(`Vous pouvez enregistrer ${MAX_EMERGENCY_CONTACTS} proches au plus.`);
    }
    try {
      return await this.prisma.emergencyContact.create({
        data: { userId, name: dto.name.trim(), phone: dto.phone },
        select: { id: true, name: true, phone: true, createdAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce numéro est déjà dans votre liste.');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const result = await this.prisma.emergencyContact.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Proche introuvable.');
    return { deleted: true };
  }
}
