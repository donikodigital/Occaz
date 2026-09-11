// backend/src/config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Toute variable d'environnement manquante ou mal typée fait échouer le
 * démarrage immédiatement, plutôt que de laisser une valeur `undefined`
 * se propager silencieusement jusqu'en production (ex: un JWT_SECRET vide).
 *
 * Les propriétés sans valeur par défaut utilisent l'assertion `!` : elles
 * sont bien remplies au runtime par `plainToInstance` + `validateSync`
 * (voir `validate()` ci-dessous), mais TypeScript ne peut pas le savoir
 * statiquement puisque `strictPropertyInitialization` exige soit un
 * initialiseur, soit une valeur assignée dans le constructeur.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsUrl({ require_tld: false, protocols: ['postgresql', 'postgres'] })
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '30d';

  @IsString()
  OTP_HASH_PEPPER!: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Configuration d'environnement invalide :\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validated;
}