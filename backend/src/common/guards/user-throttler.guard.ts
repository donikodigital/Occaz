// backend/src/common/guards/user-throttler.guard.ts
// [30/10/2026] Limite d'appels PAR UTILISATEUR (et non par adresse IP). Avant, tout le monde derrière la même adresse (Wi-Fi d'une
// gare, réseau mobile partagé, passerelle d'opérateur) se partageait 60 appels/minute : avec les actualisations automatiques de
// l'app (messages, notifications, suivi de trajet…), l'application se retrouvait en erreur 429 sans raison.
//
// Le suivi se fait sur l'identifiant du compte lu dans le jeton d'accès (signature vérifiée : un jeton falsifié ne peut pas
// consommer le quota d'autrui). Sans jeton valable (connexion, codes, routes publiques), on retombe sur l'adresse IP — les limites
// strictes posées route par route avec @Throttle restent donc inchangées face aux attaques par force brute.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { JwtAccessPayload } from '../types/jwt-payload.interface';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private readonly jwt = new JwtService({});
  private readonly accessSecret: string | undefined;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.accessSecret = config.get<string>('jwt.accessSecret');
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const header = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (match && this.accessSecret) {
      try {
        const payload = this.jwt.verify<JwtAccessPayload>(match[1], { secret: this.accessSecret });
        if (payload?.sub) return `user:${payload.sub}`;
      } catch {
        // jeton absent, expiré ou falsifié : suivi par adresse IP
      }
    }
    return String(req.ips?.length ? req.ips[0] : req.ip);
  }
}
