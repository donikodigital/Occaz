// backend/src/otp/otp.service.ts
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  private readonly logger = new Logger('OTP');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  /**
   * Le code est désormais toujours généré et persisté, que le SMS parte
   * ou non : il doit rester consultable/copiable dans l'application
   * (carte de code) indépendamment de la fiabilité du SMS (carte SIM
   * hors service, téléphone-passerelle déchargé...) — le bénéficiaire
   * peut se reconnecter depuis n'importe quel appareil pour le
   * récupérer. Le SMS reste envoyé, mais en canal best-effort, en
   * parallèle : son échec est journalisé, jamais bloquant. (Avant :
   * l'échec SMS empêchait toute persistance et remontait en 503 — donc
   * bloquait aussi l'affichage in-app, ce qui allait à l'encontre de
   * l'objectif même de cette carte "je n'ai pas reçu le SMS".)
   */
  /**
   * `revealCodeToCaller` renvoie le code en clair dans la réponse, en plus
   * du SMS — jamais pour le chauffeur (qui doit toujours le recevoir
   * verbalement du bénéficiaire, règle d'or de ce service), seulement
   * pour un endpoint où l'appelant authentifié EST le bénéficiaire
   * lui-même consultant son propre code (ex. l'expéditeur qui veut le
   * revoir dans l'app sans rouvrir le SMS). Le code n'est de toute façon
   * jamais stocké en clair : haché avant persistance comme avant, cette
   * option ne change que ce qui est renvoyé dans la réponse HTTP, pas ce
   * qui est écrit en base.
   */
  async generateAndSend(
    params: GenerateOtpParams,
    message: string,
    options?: { revealCodeToCaller?: boolean },
  ): Promise<{ expiresInSeconds: number; code?: string; smsSent: boolean }> {
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

    let smsSent = true;
    try {
      await this.smsProvider.send(params.phone, `${message} ${code}`);
    } catch (error) {
      smsSent = false;
      this.logger.warn(
        `SMS OTP non envoyé (${params.purpose}${params.bookingId ? `, booking ${params.bookingId}` : ''}${params.shipmentId ? `, shipment ${params.shipmentId}` : ''}) — code néanmoins généré et disponible dans l'application : ${(error as Error).message}`,
      );
    }

    return { expiresInSeconds: expirySeconds, code: options?.revealCodeToCaller ? code : undefined, smsSent };
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