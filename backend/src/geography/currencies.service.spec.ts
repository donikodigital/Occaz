// backend/src/geography/currencies.service.spec.ts
// Suppression d'une devise : un pays désactivé ne la bloque plus, un pays actif oui, et une devise déjà utilisée par des données
// donne un message clair au lieu d'une erreur 500.
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrenciesService } from './currencies.service';

function build(options: { activeCountry?: { name: string } | null; deleteError?: unknown } = {}) {
  const tx = {
    country: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    currency: {
      delete: options.deleteError
        ? jest.fn().mockRejectedValue(options.deleteError)
        : jest.fn().mockResolvedValue({ id: 'eur' }),
    },
  };
  const prisma = {
    currency: { findUnique: jest.fn().mockResolvedValue({ id: 'eur', isoCode: 'EUR' }) },
    country: { findFirst: jest.fn().mockResolvedValue(options.activeCountry ?? null) },
    $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new CurrenciesService(prisma as never, audit as never), prisma, tx, audit };
}

function foreignKeyError(fieldName: string) {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test',
    meta: { field_name: fieldName },
  });
}

describe('CurrenciesService — suppression', () => {
  it('ne regarde que les pays actifs pour bloquer la suppression', async () => {
    const { service, prisma } = build();
    await service.remove('eur', 'admin');
    expect(prisma.country.findFirst).toHaveBeenCalledWith({ where: { defaultCurrencyId: 'eur', isActive: true } });
  });

  it('refuse si un pays actif l’utilise par défaut', async () => {
    const { service, prisma } = build({ activeCountry: { name: 'Guinée' } });
    await expect(service.remove('eur', 'admin')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('détache les pays désactivés puis supprime la devise, dans la même transaction', async () => {
    const { service, tx, audit } = build();
    await service.remove('eur', 'admin');
    expect(tx.country.updateMany).toHaveBeenCalledWith({
      where: { defaultCurrencyId: 'eur', isActive: false },
      data: { defaultCurrencyId: null },
    });
    expect(tx.currency.delete).toHaveBeenCalledWith({ where: { id: 'eur' } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Currency', entityId: 'eur', action: 'DELETE', diff: { detachedInactiveCountries: 1 } }),
    );
  });

  it('une devise encore utilisée par des données donne un message clair (409), pas une 500', async () => {
    const { service, audit } = build({ deleteError: foreignKeyError('commission_rules_currencyId_fkey (index)') });
    const attempt = service.remove('eur', 'admin');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow('des règles de commission');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('une autre erreur est propagée telle quelle', async () => {
    const boom = new Error('boom');
    const { service } = build({ deleteError: boom });
    await expect(service.remove('eur', 'admin')).rejects.toBe(boom);
  });
});