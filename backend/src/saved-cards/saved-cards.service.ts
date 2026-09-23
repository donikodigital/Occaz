// backend/src/saved-cards/saved-cards.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddSavedCardDto } from './dto/add-saved-card.dto';

/** Cartes bancaires enregistrées par le client — jamais le PAN, voir AddSavedCardDto. */
@Injectable()
export class SavedCardsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(customerId: string) {
    return this.prisma.savedCard.findMany({ where: { customerId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async add(customerId: string, dto: AddSavedCardDto) {
    if (dto.isDefault) {
      await this.prisma.savedCard.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return this.prisma.savedCard.create({
      data: {
        customerId,
        providerId: dto.providerId,
        providerToken: dto.providerToken,
        brand: dto.brand,
        last4: dto.last4,
        expiryMonth: dto.expiryMonth,
        expiryYear: dto.expiryYear,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async setDefault(customerId: string, id: string) {
    await this.assertOwnership(customerId, id);
    await this.prisma.savedCard.updateMany({ where: { customerId }, data: { isDefault: false } });
    return this.prisma.savedCard.update({ where: { id }, data: { isDefault: true } });
  }

  async remove(customerId: string, id: string) {
    await this.assertOwnership(customerId, id);
    await this.prisma.savedCard.delete({ where: { id } });
  }

  private async assertOwnership(customerId: string, id: string): Promise<void> {
    const card = await this.prisma.savedCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Carte introuvable.');
    if (card.customerId !== customerId) throw new ForbiddenException("Cette carte n'appartient pas à ce compte.");
  }
}