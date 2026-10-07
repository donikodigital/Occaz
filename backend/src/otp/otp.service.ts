// backend/src/otp/otp.service.ts
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../common/utils/otp.util';
import { addDuration } from '../common/utils/duration.util';
import { OtpSettingsService } from './otp-settings.service';

const DAY_MS = 24 * 3_600_000;

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
 * destinataire) — jamais au conducteur, qui se contente de le saisir tel
 * qu'on le lui communique verbalement.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('OTP');

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpSettings: OtpSettingsService,
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
   * du SMS — jamais pour le conducteur (qui doit toujours le recevoir
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
    const { expirySeconds, maxAttempts, handoverSmsDailyLimit } = await this.otpSettings.get();
    const smsAllowed = await this.isHandoverSmsAllowed(params, handoverSmsDailyLimit);
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

    let smsSent = smsAllowed;
    try {
      if (smsAllowed) await this.smsProvider.send(params.phone, `${message} ${code}`);
    } catch (error) {
      smsSent = false;
      this.logger.warn(
        `SMS OTP non envoyé (${params.purpose}${params.bookingId ? `, booking ${params.bookingId}` : ''}${params.shipmentId ? `, shipment ${params.shipmentId}` : ''}) — code néanmoins généré et disponible dans l'application : ${(error as Error).message}`,
      );
    }

    return { expiresInSeconds: expirySeconds, code: options?.revealCodeToCaller ? code : undefined, smsSent };
  }

  /**
   * Plafond de SMS de remise : au plus `handoverSmsDailyLimit` (5 par défaut, réglable dans l'administration, 0 = illimité)
   * par réservation ou par envoi, pour chaque étape et par période de 24 h. Chaque appel à generateAndSend crée une ligne
   * OtpCode : on compte ces lignes. Au-delà, le code est TOUJOURS généré et reste visible dans l'application — seul le
   * SMS payant est coupé, jamais la remise elle-même.
   */
  private async isHandoverSmsAllowed(params: GenerateOtpParams, limit: number): Promise<boolean> {
    if (limit <= 0 || (!params.bookingId && !params.shipmentId)) return true;
    const sentToday = await this.prisma.otpCode.count({
      where: {
        purpose: params.purpose,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    });
    if (sentToday < limit) return true;
    this.logger.warn(
      `Plafond de SMS de remise atteint (${limit}/24 h) pour ${params.purpose}${params.bookingId ? `, booking ${params.bookingId}` : ''}${params.shipmentId ? `, shipment ${params.shipmentId}` : ''} — code généré et visible dans l'application, SMS non envoyé.`,
    );
    return false;
  }

  /**
   * Vérifie le code parmi les quelques plus récents pour ce (purpose,
   * booking|shipment) — pas seulement le tout dernier. Le bénéficiaire
   * (passager, expéditeur) peut à tout moment régénérer son code via
   * "Voir mon code" dans l'app, indépendamment d'une demande déjà faite
   * par le conducteur : sans cette petite fenêtre de tolérance, le code
   * que le conducteur vient de recevoir verbalement (ou par SMS) devient
   * invalide dès que l'autre partie régénère le sien, sans qu'aucune des
   * deux ne le sache — exactement le bug "Code invalide" alors que le
   * passager donne un code qu'il voit bien, valide, à l'écran.
   * Lève une exception explicite dans chaque cas d'échec — jamais de
   * validation implicite côté appelant.
   */
  async verify(params: VerifyOtpParams): Promise<void> {
    const candidates = await this.prisma.otpCode.findMany({
      where: {
        purpose: params.purpose,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
        status: OtpStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const latest = candidates[0];
    if (!latest || latest.expiresAt < new Date()) {
      throw new UnauthorizedException('Code expiré ou introuvable — demandez-en un nouveau.');
    }
    if (latest.attempts >= latest.maxAttempts) {
      await this.prisma.otpCode.update({ where: { id: latest.id }, data: { status: OtpStatus.FAILED } });
      throw new UnauthorizedException('Trop de tentatives — demandez un nouveau code.');
    }

    // L'essai est consommé AVANT la comparaison, de façon atomique : des requêtes parallèles ne peuvent pas dépasser le
    // nombre d'essais autorisés.
    const claimed = await this.prisma.otpCode.updateMany({
      where: { id: latest.id, status: OtpStatus.PENDING, attempts: { lt: latest.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException('Trop de tentatives — demandez un nouveau code.');
    }

    const now = new Date();
    const match = candidates.find((candidate) => candidate.expiresAt >= now && verifyOtpCode(params.code, candidate.code));
    if (!match) {
      throw new UnauthorizedException('Code invalide.');
    }

    // Usage unique : si le conducteur envoie deux fois le bon code en même temps, une seule validation passe.
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: match.id, status: OtpStatus.PENDING },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('Ce code a déjà été utilisé — demandez-en un nouveau.');
    }

    // On invalide le reste du lot : une fois un code vérifié, les éventuels
    // codes générés entre-temps ne doivent plus pouvoir resservir.
    await this.prisma.otpCode.updateMany({
      where: {
        id: { in: candidates.filter((candidate) => candidate.id !== match.id).map((candidate) => candidate.id) },
        status: OtpStatus.PENDING,
      },
      data: { status: OtpStatus.EXPIRED },
    });
  }
}