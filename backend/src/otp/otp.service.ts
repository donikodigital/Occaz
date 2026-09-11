// backend/src/otp/otp.service.ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../common/utils/otp.util';
import { addDuration } from '../common/utils/duration.util';

export interface GenerateOtpParams {
  purpose: OtpPurpose;
  phone: string;
  bookingId?: string;
  shipmentId?: string;
  userId?: string;
}

export interface VerifyOtpParams {
  purpose: OtpPurpose;
  bookingId?: string;
  shipmentId?: string;
  code: string;
}

/**
 * Service OTP générique pour les validations de prestation (section 17 :
 * OTP départ/arrivée pour un trajet, récupération/livraison pour un
 * envoi). Distinct de la logique OTP de connexion dans AuthService (Lot
 * 1), qui reste autonome pour ne pas complexifier un flux
 * d'authentification déjà vérifié — les deux partagent seulement les
 * utilitaires bas niveau (generateOtpCode/hashOtpCode/verifyOtpCode).
 *
 * Règle d'or (section 18) : le code est toujours généré ici, côté
 * serveur, et transmis uniquement au bénéficiaire (passager, expéditeur,
 * destinataire) — jamais au chauffeur, qui se contente de le saisir tel
 * qu'on le lui communique verbalement.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async generateAndSend(params: GenerateOtpParams, message: string): Promise<{ expiresInSeconds: number }> {
    const expirySeconds = this.configService.get<number>('otp.expirySeconds')!;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts')!;
    const code = generateOtpCode();

    await this.prisma.otpCode.create({
      data: {
        userId: params.userId,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
        code: hashOtpCode(code),
        purpose: params.purpose,
        status: OtpStatus.PENDING,
        maxAttempts,
        expiresAt: addDuration(`${expirySeconds}s`),
      },
    });

    await this.smsProvider.send(params.phone, `${message} ${code}`);

    return { expiresInSeconds: expirySeconds };
  }

  /**
   * Vérifie le code le plus récent pour ce (purpose, booking|shipment).
   * Lève une exception explicite dans chaque cas d'échec — jamais de
   * validation implicite côté appelant.
   */
  async verify(params: VerifyOtpParams): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        purpose: params.purpose,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
        status: OtpStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Code expiré ou introuvable — demandez-en un nouveau.');
    }
    if (otp.attempts >= otp.maxAttempts) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { status: OtpStatus.FAILED } });
      throw new UnauthorizedException('Trop de tentatives — demandez un nouveau code.');
    }
    if (!verifyOtpCode(params.code, otp.code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code invalide.');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });
  }
}
