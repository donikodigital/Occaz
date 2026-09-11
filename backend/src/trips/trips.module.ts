// backend/src/trips/trips.module.ts
import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TripOtpService } from './trip-otp.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { LocationsModule } from '../locations/locations.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { PricingModule } from '../pricing/pricing.module';
import { OtpModule } from '../otp/otp.module';
import { WalletsModule } from '../wallets/wallets.module';

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
  ],
  controllers: [TripsController, BookingsController],
  providers: [TripsService, BookingsService, TripOtpService],
  exports: [TripsService, BookingsService, TripOtpService],
})
export class TripsModule {}
