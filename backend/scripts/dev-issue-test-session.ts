// backend/scripts/dev-issue-test-session.ts
//
// Contourne UNIQUEMENT le bug réseau mobile → /auth/otp/verify (encore non
// identifié) en rejouant le flux OTP directement côté serveur, via les
// mêmes méthodes que AuthController. Ne fonctionne QUE si
// AUTH_TEST_MODE_ENABLED=true et que le(s) numéro(s) figure(nt) dans
// AUTH_TEST_PHONE_NUMBERS — mêmes garde-fous que le code existant
// (isTestPhone dans AuthService). Si ce n'est pas le cas, verifyOtpAndLogin
// échoue naturellement avec "Code invalide" (code généré aléatoire, pas
// 000000) — pas besoin de vérification manuelle en plus.
//
// Usage (depuis backend/, avec le même .env que le serveur ciblé) :
//
//   npx ts-node --transpile-only scripts/dev-issue-test-session.ts +224600000001
//   npx ts-node --transpile-only scripts/dev-issue-test-session.ts +224600000001 +224600000002 --type=DRIVER
//
// --type=CUSTOMER|DRIVER (défaut CUSTOMER) ne s'applique QUE si le compte
// n'existe pas encore — comme dans requestOtp côté backend, signupAccountType
// est ignoré si l'utilisateur existe déjà (donc si +224600000001 a déjà été
// créé en CUSTOMER lors d'un test précédent, relancer avec --type=DRIVER ne
// le changera pas rétroactivement).
//
// AUTH_TEST_STAFF_EMAILS (SUPPORT/SUPERADMIN) suit un flux différent
// (email + mot de passe, pas OTP) — non couvert par ce script.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find((a) => a.startsWith('--type='));
  const accountType = (typeArg?.split('=')[1] ?? 'CUSTOMER') as 'CUSTOMER' | 'DRIVER';
  const phones = args.filter((a) => !a.startsWith('--'));

  if (phones.length === 0) {
    console.error(
      'Usage: ts-node scripts/dev-issue-test-session.ts <phone> [<phone> ...] [--type=CUSTOMER|DRIVER]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    if (process.env.AUTH_TEST_MODE_ENABLED !== 'true') {
      console.error(
        'AUTH_TEST_MODE_ENABLED doit valoir "true" dans le .env chargé par ce backend.',
      );
      process.exit(1);
    }

    const authService = app.get(AuthService);

    for (const phone of phones) {
      try {
        await authService.requestOtp({ phone, signupAccountType: accountType } as any);
        const result = await authService.verifyOtpAndLogin(
          { phone, code: '000000', device: { platform: 'ios' } } as any,
          {},
        );
        console.log(`\n--- ${phone} ---`);
        console.log('userId       :', result.user.id);
        console.log('accountType  :', result.user.accountType);
        console.log('accessToken  :', result.accessToken);
        console.log('refreshToken :', result.refreshToken);
      } catch (err) {
        console.error(`\n--- ${phone} : échec ---`, err instanceof Error ? err.message : err);
      }
    }
    console.log('');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});