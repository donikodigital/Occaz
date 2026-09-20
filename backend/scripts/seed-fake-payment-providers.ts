// backend/scripts/seed-fake-payment-providers.ts
//
// Script ponctuel — insère 2 moyens de paiement fictifs (tous deux
// pointent vers SimulatedPaymentProvider, voir payment-provider-registry
// .service.ts) pour pouvoir tester le flux de paiement de bout en bout.
// Idempotent : relancer ce script ne crée pas de doublons.
//
// Exécution : npx ts-node backend/scripts/seed-fake-payment-providers.ts
// (depuis la racine du repo, ou ajuste le chemin si lancé depuis backend/)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const providers = [
    { type: 'ORANGE_MONEY' as const, name: 'Orange Money (test)' },
    { type: 'MOBILE_MONEY_XOF' as const, name: 'Mobile Money (test)' },
  ];

  for (const provider of providers) {
    const existing = await prisma.paymentProvider.findFirst({
      where: { name: provider.name },
    });
    if (existing) {
      console.log(`Déjà présent : ${provider.name}`);
      continue;
    }
    const created = await prisma.paymentProvider.create({
      data: {
        type: provider.type,
        name: provider.name,
        countryId: null, // disponible dans tous les pays
        isActive: true,
      },
    });
    console.log(`Créé : ${created.name} (${created.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());