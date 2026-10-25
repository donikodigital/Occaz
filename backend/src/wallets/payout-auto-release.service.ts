// backend/src/wallets/payout-auto-release.service.ts
// [25/10/2026] v1 — Envoi automatique des retraits dont le délai de sécurité (nouveau numéro) est écoulé. Aucune intervention du
// support ni du super admin : seul le mode MANUEL attend l'équipe.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { PayoutsService } from './payouts.service';

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class PayoutAutoReleaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutAutoReleaseService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly payouts: PayoutsService,
    private readonly pricing: PricingService,
  ) {}

  onModuleInit(): void {
    if (process.env.PAYOUT_AUTO_RELEASE_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      // Interrupteur de l'administration (Paramètres → Tâches automatiques) : lu à chaque passage.
      if ((await this.pricing.getNumericSetting('jobs.payout_auto_release_enabled', 1)) === 0) return 0;
      return await this.payouts.releaseDue();
    } catch (error) {
      this.logger.error("Échec de l'envoi automatique des retraits à échéance", error as Error);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
