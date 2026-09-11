// backend/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtAccessPayload } from '../../common/types/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/types/request-with-user.interface';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../sessions.service';
import { UserRolesService } from '../../rbac/user-roles.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly userRolesService: UserRolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  /**
   * Exécuté par Passport à chaque requête authentifiée. Le résultat
   * devient `request.user`. On revalide la session à chaque appel (pas
   * seulement à l'émission du token) pour qu'une révocation ou
   * suspension prenne effet immédiatement, sans attendre l'expiration
   * du court access token.
   */
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const session = await this.sessionsService.validateAndGet(payload.sessionId);
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Session invalide.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }
    if (user.isSuspended) {
      throw new UnauthorizedException('Compte suspendu.');
    }

    const { permissions, scopedCountryIds } =
      await this.userRolesService.getEffectivePermissions(user.id);

    return {
      id: user.id,
      phone: user.phone,
      accountType: user.accountType,
      sessionId: payload.sessionId,
      permissions,
      scopedCountryIds,
    };
  }
}
