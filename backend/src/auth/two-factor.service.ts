// backend/src/auth/two-factor.service.ts
import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

/**
 * TOTP (RFC 6238) pour la 2FA obligatoire du SuperAdmin et recommandée
 * pour le Support (section 3.1). Le secret est stocké chiffré au repos
 * (voir note de sécurité dans schema.prisma) — ce service ne fait que
 * générer/vérifier, jamais logguer le secret en clair.
 */
@Injectable()
export class TwoFactorService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  getOtpAuthUri(secret: string, accountLabel: string, issuer = 'TransportPartage'): string {
    return authenticator.keyuri(accountLabel, issuer, secret);
  }

  verify(code: string, secret: string): boolean {
    return authenticator.check(code, secret);
  }
}
