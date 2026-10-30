// backend/src/app.module.ts
// [25/10/2026] v+ — + CompanyDocumentsModule (documents de l'entreprise).
// [25/10/2026] v+ — + AccountingModule (comptabilité, fiches de paie, exports).
// [20/10/2026] v+ — + StaffAccountsModule (création des comptes d'équipe depuis le back-office).
// [19/10/2026] v+ — JobsModule (déclencheur externe des traitements automatiques) et AppConfigModule (version minimale de l'application).
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { GeographyModule } from './geography/geography.module';
import { RbacModule } from './rbac/rbac.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { UsersModule } from './users/users.module';
import { StaffAccountsModule } from './staff-accounts/staff-accounts.module';
import { DevicesModule } from './devices/devices.module';
import { AuthModule } from './auth/auth.module';
import { CustomerProfilesModule } from './profiles/customer-profiles/customer-profiles.module';
import { DriverProfilesModule } from './profiles/driver-profiles/driver-profiles.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DocumentsModule } from './documents/documents.module';
import { LocationsModule } from './locations/locations.module';
import { PricingModule } from './pricing/pricing.module';
import { TripsModule } from './trips/trips.module';
import { ShipmentCategoriesModule } from './shipment-categories/shipment-categories.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { PaymentProvidersModule } from './payment-providers/payment-providers.module';
import { WalletsModule } from './wallets/wallets.module';
import { AccountRolesModule } from './account-roles/account-roles.module';
import { PlatformWalletModule } from './platform-wallet/platform-wallet.module';
import { AccountingModule } from './accounting/accounting.module';
import { CompanyDocumentsModule } from './company-documents/company-documents.module';
import { PaymentsModule } from './payments/payments.module';
import { VerificationsModule } from './verifications/verifications.module';
import { RatingsModule } from './ratings/ratings.module';
import { DisputesModule } from './disputes/disputes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { TripPricingModule } from './trip-pricing/trip-pricing.module';
import { TranslationsModule } from './translations/translations.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { ReferralsModule } from './referrals/referrals.module';
import { DealsModule } from './deals/deals.module';
import { ArticlesModule } from './articles/articles.module';
import { SavedCardsModule } from './saved-cards/saved-cards.module';
import { CookieConsentModule } from './cookie-consent/cookie-consent.module';
import { CountryScopeModule } from './common/scope/country-scope.module';
import { TicketsModule } from './tickets/tickets.module';
import { TrackingModule } from './tracking/tracking.module';
import { UserSafetyModule } from './user-safety/user-safety.module';
import { JobsModule } from './jobs/jobs.module';
import { AppConfigModule } from './app-config/app-config.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Anti-abus générique (section 42, "rate limiting, protection brute force") — 300 requêtes / minute PAR UTILISATEUR connecté
    // (par adresse IP pour les appels sans jeton valable : voir UserThrottlerGuard). Les actualisations automatiques de l'app
    // (messages, notifications, suivi de trajet…) tiennent largement dans ce plafond. Les routes sensibles (connexion, codes…)
    // gardent leurs limites strictes posées route par route avec @Throttle(...).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    EventEmitterModule.forRoot(),

    PrismaModule,
    AuditModule,

    GeographyModule,
    RbacModule,
    SeedModule,
    HealthModule,
    GeocodingModule,
    UsersModule,
    StaffAccountsModule,
    DevicesModule,
    AuthModule,

    CustomerProfilesModule,
    DriverProfilesModule,
    VehiclesModule,
    DocumentsModule,
    LocationsModule,
    PricingModule,
    TripsModule,
    ShipmentCategoriesModule,
    ShipmentsModule,
    PaymentProvidersModule,
    WalletsModule,
    AccountRolesModule,
    PlatformWalletModule,
    AccountingModule,
    CompanyDocumentsModule,
    PaymentsModule,
    VerificationsModule,
    RatingsModule,
    DisputesModule,
    NotificationsModule,
    ConversationsModule,
    PlatformSettingsModule,
    TripPricingModule,
    TranslationsModule,
    DashboardsModule,
    PromoCodesModule,
    ReferralsModule,
    DealsModule,
    ArticlesModule,
    SavedCardsModule,
    CookieConsentModule,
    CountryScopeModule,
    TicketsModule,
    TrackingModule,
    UserSafetyModule,
    JobsModule,
    AppConfigModule,

    // Toutes les Parties du cahier des charges sont couvertes — voir
    // README.md pour la correspondance Lot / section.
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Applique HttpExceptionFilter / PrismaExceptionFilter (mêmes réponses) et remonte les vraies erreurs serveur à Sentry.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}