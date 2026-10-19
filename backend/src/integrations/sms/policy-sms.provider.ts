// backend/src/integrations/sms/policy-sms.provider.ts
// [19/10/2026] v1 — Enveloppe placée devant le vrai fournisseur SMS : un SMS dont le motif n'est pas autorisé (voir sms-purpose.ts) n'atteint
// jamais le fournisseur, donc ne coûte rien. Un appel qui oublie de préciser son motif est refusé aussi : rien ne part « par erreur ».
import { Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';
import { isSmsPurposeAllowed, SmsPurpose, SmsPurposeNotAllowedError } from './sms-purpose';

export class PolicySmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  constructor(
    private readonly inner: SmsProvider,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async send(toPhone: string, message: string, purpose?: SmsPurpose): Promise<void> {
    if (!isSmsPurposeAllowed(purpose, this.env)) {
      this.logger.warn(`SMS non envoyé (motif ${purpose ?? 'non précisé'} fermé par la politique d'envoi).`);
      throw new SmsPurposeNotAllowedError(purpose);
    }
    return this.inner.send(toPhone, message, purpose);
  }
}
