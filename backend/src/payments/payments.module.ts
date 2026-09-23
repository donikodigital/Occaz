// backend/src/payments/payments.module.ts
// [23/09/2026] v+ — ReferralsModule (détection de la première prestation payée d'un filleul).
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProviderRegistry } from './providers/payment-provider-registry.service';
import { SimulatedPaymentProvider } from './providers/simulated-payment.provider';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TripsModule } from '../trips/trips.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';

/**
 * Importe TripsModule et ShipmentsModule (pour confirmer les paiements
 * côté métier) sans risque de cycle : ni l'un ni l'autre n'importe
 * PaymentsModule — le sens inverse (déclenchement d'un remboursement à
 * l'annulation) passe par les événements de domaine, pas par un import
 * de module. Voir common/events/domain-events.ts. Même chose pour
 * ReferralsModule : aucun des deux ne dépend de l'autre.
 */
@Module({
  imports: [
    PaymentProvidersModule,
    WalletsModule,
    TripsModule,
    ShipmentsModule,
    CustomerProfilesModule,
    NotificationsModule,
    ReferralsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderRegistry, SimulatedPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}