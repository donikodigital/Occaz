// backend/src/user-safety/dto/list-queries.spec.ts
// Les filtres des listes SOS et Signalements doivent traverser le ValidationPipe global (whitelist + forbidNonWhitelisted).
import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListSosQueryDto, ListUserReportsQueryDto } from './user-safety.dto';

// Même configuration que main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const parse = (metatype: new () => object, query: Record<string, string>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<Record<string, unknown>>;

describe('Listes SOS et signalements — filtres acceptés', () => {
  it('SOS : statut + pagination', async () => {
    expect(await parse(ListSosQueryDto, { page: '1', limit: '20', status: 'RESOLVED' })).toMatchObject({ page: 1, limit: 20, status: 'RESOLVED' });
  });

  it('SOS : un statut inconnu est refusé', async () => {
    await expect(parse(ListSosQueryDto, { status: 'NOPE' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signalements : statut + personne signalée', async () => {
    expect(await parse(ListUserReportsQueryDto, { status: 'IN_REVIEW', reportedUserId: 'u1' })).toMatchObject({ status: 'IN_REVIEW', reportedUserId: 'u1' });
  });

  it('signalements : sans filtre, ça marche toujours', async () => {
    await expect(parse(ListUserReportsQueryDto, { page: '1' })).resolves.toBeDefined();
  });

  it('un paramètre inconnu reste refusé', async () => {
    await expect(parse(ListSosQueryDto, { foo: 'bar' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
