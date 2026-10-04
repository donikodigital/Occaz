// backend/src/common/safety/production-safety.service.ts
//
// Contrôle de démarrage « prêt pour le public ? ». En production, liste les réglages qui seraient dangereux avec de
// vrais utilisateurs : paiements simulés, mode test d'authentification, CORS ouvert, secrets faibles, SMS / email non
// branchés. Par défaut il se contente d'écrire un avertissement dans les logs (le serveur démarre quand même, pour ne
// pas casser une plateforme encore en phase de test). Avec PRODUCTION_STRICT=true, la moindre alerte bloque le
// démarrage : à activer le jour du lancement public, une fois tout branché.
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PaymentProviderType } from '@prisma/client';
import { PaymentProviderRegistry } from '../../payments/providers/payment-provider-registry.service';
import { SimulatedPaymentProvider } from '../../payments/providers/simulated-payment.provider';

const MIN_SECRET_LENGTH = 32;

@Injectable()
export class ProductionSafetyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductionSafetyService.name);

  constructor(private readonly registry: PaymentProviderRegistry) {}

  /** Réglages à corriger avant une ouverture au public. Liste vide = prêt. */
  collectIssues(env: NodeJS.ProcessEnv = process.env): string[] {
    const issues: string[] = [];

    if (env.AUTH_TEST_MODE_ENABLED === 'true') {
      issues.push(
        'AUTH_TEST_MODE_ENABLED=true : les numéros et emails de test se connectent avec le code fixe 000000 et la 2FA est ignorée.',
      );
    }

    const simulatedTypes = Object.values(PaymentProviderType).filter(
      (type) => this.registry.resolve(type) instanceof SimulatedPaymentProvider,
    );
    if (simulatedTypes.length > 0) {
      issues.push(
        `Paiements simulés (${simulatedTypes.join(', ')}) : aucun argent réel n'est encaissé ni remboursé. Brancher les vrais prestataires dans PaymentProviderRegistry.`,
      );
    }

    if (!env.TEXTBEE_API_KEY) {
      issues.push(
        "Aucun prestataire SMS configuré (TEXTBEE_API_KEY absent) : les codes de connexion ne sont pas envoyés, ils s'écrivent seulement dans les logs.",
      );
    }
    if (!env.RESEND_API_KEY) {
      issues.push('Aucun prestataire email configuré (RESEND_API_KEY absent) : les emails ne sont pas envoyés.');
    }
    if (!env.MAPBOX_ACCESS_TOKEN) {
      issues.push('MAPBOX_ACCESS_TOKEN absent : géocodage et itinéraires indisponibles.');
    }

    if (!env.CORS_ALLOWED_ORIGINS?.trim()) {
      issues.push("CORS_ALLOWED_ORIGINS vide : n'importe quel site web peut appeler l'API avec les identifiants de l'utilisateur.");
    }

    const secrets: Array<[string, string | undefined]> = [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
      ['OTP_HASH_PEPPER', env.OTP_HASH_PEPPER],
    ];
    for (const [name, value] of secrets) {
      if (!value || value.length < MIN_SECRET_LENGTH) {
        issues.push(`${name} trop court (moins de ${MIN_SECRET_LENGTH} caractères) : générez une valeur aléatoire longue.`);
      }
    }
    const distinct = new Set(secrets.map(([, value]) => value).filter(Boolean));
    if (distinct.size < secrets.filter(([, value]) => value).length) {
      issues.push('JWT_ACCESS_SECRET, JWT_REFRESH_SECRET et OTP_HASH_PEPPER doivent être trois valeurs différentes.');
    }

    if (env.SWAGGER_ENABLED === 'true') {
      issues.push("SWAGGER_ENABLED=true : la documentation de l'API est publique.");
    }

    return issues;
  }

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV !== 'production') return;

    const issues = this.collectIssues();
    if (issues.length === 0) {
      this.logger.log('Contrôles de sécurité de production : tout est en ordre.');
      return;
    }

    const report = issues.map((issue, index) => `  ${index + 1}. ${issue}`).join('\n');
    if (process.env.PRODUCTION_STRICT === 'true') {
      throw new Error(
        `Démarrage refusé (PRODUCTION_STRICT=true) : ${issues.length} réglage(s) à corriger avant l'ouverture au public :\n${report}`,
      );
    }
    this.logger.warn(
      `${issues.length} point(s) à régler avant l'ouverture au public (le serveur démarre quand même ; PRODUCTION_STRICT=true bloquerait le démarrage) :\n${report}`,
    );
  }
}
