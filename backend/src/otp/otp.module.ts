// backend/src/otp/otp.module.ts
import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpSettingsService } from './otp-settings.service';
import { SmsModule } from '../integrations/sms/sms.module';

@Module({
  imports: [SmsModule],
  providers: [OtpService, OtpSettingsService],
  exports: [OtpService, OtpSettingsService],
})
export class OtpModule {}
