// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { TwoFactorService } from './two-factor.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { DevicesModule } from '../devices/devices.module';
import { RbacModule } from '../rbac/rbac.module';
import { SmsModule } from '../integrations/sms/sms.module';
import { EmailModule } from '../integrations/email/email.module';

@Module({
  imports: [
    UsersModule,
    DevicesModule,
    RbacModule,
    SmsModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // Les secrets réels sont fournis par appel (sign/verify) selon le
      // type de token — cette config globale ne sert que de valeur par
      // défaut pour les usages simples du module.
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret')!,
        signOptions: { expiresIn: configService.get<string>('jwt.accessExpiresIn')! },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, TwoFactorService, JwtStrategy],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
