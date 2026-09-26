// backend/src/trips/trips.module.ts
// [23/09/2026] v4 — TripExpiryService (trajets publiés sans réservation, dont le départ est dépassé).
// [23/09/2026] v3 — PromoCodesModule (code promo à la création d'une réservation).
// [22/09/2026] v2 — BookingExpiryService (expiration des réservations impayées).
import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingExpiryService } from './booking-expiry.service';
import { TripExpiryService } from './trip-expiry.service';
import { TripOtpService } from './trip-otp.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { LocationsModule } from '../locations/locations.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { PricingModule } from '../pricing/pricing.module';
import { OtpModule } from '../otp/otp.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Trip, Booking et TripOtp partagent un seul module : Booking ne peut pas
 * exister sans Trip, l'annulation d'un trajet doit cascader sur ses
 * réservations, et la validation OTP touche les deux à la fois — les
 * séparer créerait des imports circulaires entre modules Nest.
 */
@Module({
  imports: [
    VehiclesModule,
    LocationsModule,
    DriverProfilesModule,
    CustomerProfilesModule,
    PricingModule,
    OtpModule,
    WalletsModule,
    PromoCodesModule,
    NotificationsModule,
  ],
  controllers: [TripsController, BookingsController],
  providers: [TripsService, BookingsService, TripOtpService, BookingExpiryService, TripExpiryService],
  exports: [TripsService, BookingsService, TripOtpService],
})
export class TripsModule {}