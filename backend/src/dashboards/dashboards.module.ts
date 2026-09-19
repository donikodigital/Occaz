// backend/src/dashboards/dashboards.module.ts
import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DriverDashboardService } from './driver-dashboard.service';
import { CustomerDashboardService } from './customer-dashboard.service';
import { SupportDashboardService } from './support-dashboard.service';
import { CommissionSummaryService } from './commission-summary.service';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';

@Module({
  imports: [DriverProfilesModule, CustomerProfilesModule],
  controllers: [DashboardsController],
  providers: [
    AdminDashboardService,
    DriverDashboardService,
    CustomerDashboardService,
    SupportDashboardService,
    CommissionSummaryService,
  ],
})
export class DashboardsModule {}