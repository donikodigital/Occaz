// backend/src/cookie-consent/cookie-consent.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordCookieConsentDto } from './dto/record-cookie-consent.dto';

/**
 * Un enregistrement par choix — jamais écrasé, pour prouver a posteriori
 * quel texte l'utilisateur a accepté (voir schema.prisma, CookieConsent).
 */
@Injectable()
export class CookieConsentService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    dto: RecordCookieConsentDto,
    context: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.prisma.cookieConsent.create({
      data: {
        userId: context.userId,
        choice: dto.choice,
        policyVersion: dto.policyVersion,
        categories: dto.categories,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  }
}