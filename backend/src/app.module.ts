// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { GeographyModule } from './geography/geography.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './users/users.module';
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
import { PaymentsModule } from './payments/payments.module';
import { VerificationsModule } from './verifications/verifications.module';
import { RatingsModule } from './ratings/ratings.module';
import { DisputesModule } from './disputes/disputes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { TranslationsModule } from './translations/translations.module';
import { DashboardsModule } from './dashboards/dashboards.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Anti-brute-force générique (section 42, "rate limiting, protection
    // brute force") — 60 requêtes / minute par IP par défaut ; des
    // limites plus strictes peuvent être posées route par route plus
    // tard (ex: /auth/otp/request) avec @Throttle(...).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    EventEmitterModule.forRoot(),

    PrismaModule,
    AuditModule,

    GeographyModule,
    RbacModule,
    UsersModule,
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
    PaymentsModule,
    VerificationsModule,
    RatingsModule,
    DisputesModule,
    NotificationsModule,
    ConversationsModule,
    PlatformSettingsModule,
    TranslationsModule,
    DashboardsModule,

    // Toutes les Parties du cahier des charges sont couvertes — voir
    // README.md pour la correspondance Lot / section.
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}
