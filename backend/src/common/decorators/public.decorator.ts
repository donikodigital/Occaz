// backend/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Marque une route comme accessible sans authentification (ex: demande
 * d'OTP, login). À utiliser avec parcimonie — par défaut toute route est
 * protégée par le JwtAuthGuard global (voir app.module.ts).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
