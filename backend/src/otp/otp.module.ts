// backend/src/otp/otp.module.ts
import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { SmsModule } from '../integrations/sms/sms.module';

@Module({
  imports: [SmsModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
