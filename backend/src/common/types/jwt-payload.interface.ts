// backend/src/common/types/jwt-payload.interface.ts
import { AccountType } from '@prisma/client';

/** Contenu signé dans l'access token JWT (courte durée de vie). */
export interface JwtAccessPayload {
  sub: string; // userId
  accountType: AccountType;
  sessionId: string;
}

/** Contenu signé dans le refresh token JWT (longue durée, un par session/appareil). */
export interface JwtRefreshPayload {
  sub: string; // userId
  sessionId: string;
}
