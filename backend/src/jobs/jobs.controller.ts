// backend/src/jobs/jobs.controller.ts
// [19/10/2026] v1 — Déclencheur EXTERNE des traitements automatiques : POST /api/v1/jobs/run, appelé toutes les 5 minutes par une tâche
// planifiée (GitHub Actions : .github/workflows/run-jobs.yml). Pourquoi : les minuteries internes (setInterval) ne tournent que pendant que
// le serveur est éveillé ; sur un hébergement qui met l'instance en veille (Render gratuit), réservations impayées, rappels de départ et
// plages de dates n'étaient plus traités. Un appel HTTP réveille le serveur ET lance les traitements.
//
// Sécurité : route publique (pas de session), protégée par le secret JOBS_SECRET envoyé dans l'en-tête « x-jobs-secret ».
//  - JOBS_SECRET absent ou trop court (< 24 caractères) : la route répond 404, comme si elle n'existait pas ;
//  - mauvais secret : 401 ; comparaison à temps constant ;
//  - 6 appels par minute au plus.
import { Controller, HttpCode, HttpStatus, Headers, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { JobsService } from './jobs.service';

const MIN_SECRET_LENGTH = 24;

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Vrai si `provided` est exactement le secret attendu (comparaison à temps constant). */
export function jobsSecretMatches(expected: string, provided: string | undefined): boolean {
  if (!provided) return false;
  return timingSafeEqual(digest(expected), digest(provided));
}

@ApiExcludeController()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async run(@Headers('x-jobs-secret') provided?: string) {
    const expected = process.env.JOBS_SECRET?.trim();
    if (!expected || expected.length < MIN_SECRET_LENGTH) throw new NotFoundException();
    if (!jobsSecretMatches(expected, provided)) throw new UnauthorizedException('Secret invalide.');

    const results = await this.jobs.runAll();
    return { ok: results.every((result) => result.ok), results };
  }
}
