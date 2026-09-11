// backend/src/devices/devices.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.device.create({
      data: {
        userId,
        platform: dto.platform,
        pushToken: dto.pushToken,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Utilisé par le flux de connexion : réutilise l'appareil existant
   * (identifié par son pushToken) plutôt que d'en créer un nouveau à
   * chaque login, sinon la table Device grossirait indéfiniment pour un
   * même téléphone physique.
   */
  async findOrCreateForLogin(
    userId: string,
    deviceInfo?: { platform?: 'ios' | 'android' | 'web'; pushToken?: string },
  ) {
    if (!deviceInfo?.platform) return null;

    if (deviceInfo.pushToken) {
      const existing = await this.prisma.device.findFirst({
        where: { userId, pushToken: deviceInfo.pushToken },
      });
      if (existing) {
        return this.prisma.device.update({
          where: { id: existing.id },
          data: { lastSeenAt: new Date(), isTrusted: true },
        });
      }
    }

    return this.prisma.device.create({
      data: {
        userId,
        platform: deviceInfo.platform,
        pushToken: deviceInfo.pushToken,
        lastSeenAt: new Date(),
        isTrusted: true,
      },
    });
  }

  async updatePushToken(deviceId: string, pushToken: string) {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { pushToken, lastSeenAt: new Date() },
    });
  }

  async remove(deviceId: string, userId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Appareil introuvable.');
    if (device.userId !== userId) {
      throw new ForbiddenException("Cet appareil n'appartient pas à cet utilisateur.");
    }
    await this.prisma.session.updateMany({
      where: { deviceId },
      data: { isRevoked: true },
    });
    await this.prisma.device.delete({ where: { id: deviceId } });
  }
}
