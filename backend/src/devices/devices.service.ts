// backend/src/devices/devices.service.ts
// [25/10/2026] v2 — Un token push = un téléphone = une seule ligne. Avant, chaque ouverture de l'application (POST /devices) créait une
// nouvelle ligne avec le même token, et NotificationsService envoyait la notification une fois par ligne : 3 lignes = 3 notifications
// identiques. L'enregistrement réutilise désormais la ligne du token ; si ce téléphone appartenait à un autre compte (changement de
// compte sur le même téléphone), le token lui est retiré : l'ancien compte ne reçoit plus les notifications du nouveau.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

type DevicePlatform = 'ios' | 'android' | 'web';

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
    if (!dto.pushToken) {
      return this.prisma.device.create({
        data: { userId, platform: dto.platform, lastSeenAt: new Date() },
      });
    }
    return this.attachPushToken(userId, dto.platform, dto.pushToken, false);
  }

  /**
   * Utilisé par le flux de connexion : réutilise l'appareil existant
   * (identifié par son pushToken) plutôt que d'en créer un nouveau à
   * chaque login, sinon la table Device grossirait indéfiniment pour un
   * même téléphone physique.
   */
  async findOrCreateForLogin(
    userId: string,
    deviceInfo?: { platform?: DevicePlatform; pushToken?: string },
  ) {
    if (!deviceInfo?.platform) return null;

    if (deviceInfo.pushToken) {
      return this.attachPushToken(userId, deviceInfo.platform, deviceInfo.pushToken, true);
    }

    return this.prisma.device.create({
      data: {
        userId,
        platform: deviceInfo.platform,
        lastSeenAt: new Date(),
        isTrusted: true,
      },
    });
  }

  async updatePushToken(deviceId: string, pushToken: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Appareil introuvable.');
    return this.attachPushToken(device.userId, device.platform as DevicePlatform, pushToken, false);
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

  /**
   * Rattache un token push à un compte : une seule ligne par token, jamais de doublon.
   *  1. le token est retiré aux lignes des AUTRES comptes (ce téléphone appartient maintenant à celui-ci) ;
   *  2. la ligne du token est mise à jour, ou créée si le token est nouveau ;
   *  3. deux demandes simultanées (ouverture de l'app + connexion) : l'index unique de la base en laisse passer une seule, l'autre
   *     reprend et met à jour la ligne que la première vient de créer.
   */
  private async attachPushToken(userId: string, platform: DevicePlatform, pushToken: string, trusted: boolean) {
    const attempt = async () => {
      await this.prisma.device.updateMany({
        where: { pushToken, userId: { not: userId } },
        data: { pushToken: null },
      });
      const fields = { userId, platform, lastSeenAt: new Date(), ...(trusted ? { isTrusted: true } : {}) };
      const existing = await this.prisma.device.findUnique({ where: { pushToken } });
      if (existing) {
        return this.prisma.device.update({ where: { id: existing.id }, data: fields });
      }
      return this.prisma.device.create({ data: { ...fields, pushToken } });
    };

    try {
      return await attempt();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return attempt();
      throw error;
    }
  }
}
