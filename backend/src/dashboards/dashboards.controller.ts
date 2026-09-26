// backend/src/dashboards/dashboards.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AdminDashboardService } from './admin-dashboard.service';
import { DriverDashboardService } from './driver-dashboard.service';
import { CustomerDashboardService } from './customer-dashboard.service';
import { SupportDashboardService } from './support-dashboard.service';
import { CommissionSummaryService } from './commission-summary.service';
import { RevenueTimeSeriesDto } from './dto/revenue-time-series.dto';
import { CommissionSummaryQueryDto } from './dto/commission-summary-query.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';

@ApiTags('Tableaux de bord')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardsController {
  constructor(
    private readonly adminDashboard: AdminDashboardService,
    private readonly driverDashboard: DriverDashboardService,
    private readonly customerDashboard: CustomerDashboardService,
    private readonly supportDashboard: SupportDashboardService,
    private readonly commissionSummary: CommissionSummaryService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly customerProfilesService: CustomerProfilesService,
  ) {}

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin')
  getAdminOverview() {
    return this.adminDashboard.getOverview();
  }

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/volume-by-country')
  getVolumeByCountry() {
    return this.adminDashboard.getVolumeByCountry();
  }

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/volume-by-currency')
  getVolumeByCurrency() {
    return this.adminDashboard.getVolumeByCurrency();
  }

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/revenue-time-series')
  getRevenueTimeSeries(@Query() query: RevenueTimeSeriesDto) {
    return this.adminDashboard.getRevenueTimeSeries(
      query.granularity,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/activity-time-series')
  getActivityTimeSeries(@Query() query: RevenueTimeSeriesDto) {
    return this.adminDashboard.getActivityTimeSeries(
      query.granularity,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/top-routes')
  getTopRoutes() {
    return this.adminDashboard.getTopRoutes();
  }

  /** Commissions filtrées par période préréglée (semaine/mois/trimestre/année), avec comparaison à la période précédente. */
  @Permissions(PERMISSIONS.DASHBOARD_ADMIN_READ)
  @Get('admin/commission-summary')
  getCommissionSummary(@Query() query: CommissionSummaryQueryDto) {
    return this.commissionSummary.getSummary(query.period ?? 'month');
  }

  @Get('driver/mine')
  async getMyDriverDashboard(@CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.driverDashboard.getOverview(driverId);
  }

  @Get('customer/mine')
  async getMyCustomerDashboard(@CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.customerDashboard.getOverview(customer.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_READ)
  @Get('support')
  getSupportOverview() {
    return this.supportDashboard.getOverview();
  }
}