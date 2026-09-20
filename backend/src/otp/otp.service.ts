// backend/src/otp/otp.service.ts
import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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

  /**
   * Le code est envoyé AVANT d'être persisté : si l'envoi SMS échoue
   * (panne du prestataire, clé manquante, réseau...), aucune ligne
   * OtpCode n'est créée — plutôt qu'un code en base jamais communiqué au
   * bénéficiaire (qui aurait bloqué silencieusement toute tentative de
   * vérification ultérieure, et pollué "le plus récent" consulté par
   * verify()). L'échec remonte comme une 503 explicite (dépendance
   * externe indisponible), jamais un crash 500 générique.
   */
  async generateAndSend(params: GenerateOtpParams, message: string): Promise<{ expiresInSeconds: number }> {
    const expirySeconds = this.configService.get<number>('otp.expirySeconds')!;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts')!;
    const code = generateOtpCode();

    try {
      await this.smsProvider.send(params.phone, `${message} ${code}`);
    } catch (error) {
      throw new ServiceUnavailableException(
        `Impossible d'envoyer le code par SMS pour le moment — réessayez dans quelques instants. (${(error as Error).message})`,
      );
    }

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