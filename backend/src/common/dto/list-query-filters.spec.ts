// backend/src/common/dto/list-query-filters.spec.ts
// Les filtres des listes d'administration doivent traverser le ValidationPipe global (whitelist + forbidNonWhitelisted) : avant,
// ils étaient lus par des @Query('…') séparés et toute la requête était rejetée en 400 dès qu'un filtre était choisi.
import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListDisputesQueryDto } from '../../disputes/dto/list-disputes-query.dto';
import { ListVerificationsQueryDto } from '../../verifications/dto/list-verifications-query.dto';
import { ListCustomerProfilesQueryDto } from '../../profiles/customer-profiles/dto/list-customer-profiles-query.dto';
import { ListPublishedArticlesQueryDto } from '../../articles/dto/list-published-articles-query.dto';
import { ListTranslationsQueryDto } from '../../translations/dto/list-translations-query.dto';

// Même configuration que main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const parse = (metatype: new () => object, query: Record<string, string>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<Record<string, unknown>>;

describe('Filtres des listes — acceptés par le ValidationPipe global', () => {
  it('litiges : statut + priorité + agent + pagination', async () => {
    const out = await parse(ListDisputesQueryDto, { page: '2', limit: '20', status: 'CLOSED', priority: 'HIGH', assignedAgentId: 'u1' });
    expect(out).toMatchObject({ page: 2, limit: 20, status: 'CLOSED', priority: 'HIGH', assignedAgentId: 'u1' });
  });

  it('litiges : sans filtre, ça marche toujours', async () => {
    await expect(parse(ListDisputesQueryDto, { page: '1', limit: '20' })).resolves.toBeDefined();
  });

  it('litiges : un statut inconnu est refusé (400)', async () => {
    await expect(parse(ListDisputesQueryDto, { status: 'NOPE' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vérifications : statut + type', async () => {
    const out = await parse(ListVerificationsQueryDto, { status: 'PENDING', type: 'DRIVER_LICENSE' });
    expect(out).toMatchObject({ status: 'PENDING', type: 'DRIVER_LICENSE' });
  });

  it('clients : pays', async () => {
    expect(await parse(ListCustomerProfilesQueryDto, { countryId: 'gn' })).toMatchObject({ countryId: 'gn' });
  });

  it('actualités publiées : pays', async () => {
    expect(await parse(ListPublishedArticlesQueryDto, { page: '1', countryId: 'gn' })).toMatchObject({ countryId: 'gn' });
  });

  it('traductions : type + langue', async () => {
    expect(await parse(ListTranslationsQueryDto, { entityType: 'Country', locale: 'pt' })).toMatchObject({ entityType: 'Country', locale: 'pt' });
  });

  it('un paramètre inconnu reste refusé', async () => {
    await expect(parse(ListDisputesQueryDto, { foo: 'bar' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
