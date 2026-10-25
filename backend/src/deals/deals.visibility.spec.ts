// backend/src/deals/deals.visibility.spec.ts
// Un bon plan / une actualité qui n'est pas publié ne se lit pas par son identifiant (404) ; la gestion des promotions les voit tous.
import { NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { ArticlesController } from '../articles/articles.controller';
import { ArticlesService } from '../articles/articles.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

describe('DealsService — visibilité', () => {
  it('findOneActive filtre sur actif + fenêtre de dates', async () => {
    const prisma = { deal: { findFirst: jest.fn().mockResolvedValue({ id: 'd1' }) } };
    const service = new DealsService(prisma as never);
    await service.findOneActive('d1');
    const where = prisma.deal.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'd1', isActive: true });
    expect(JSON.stringify(where)).toContain('startsAt');
    expect(JSON.stringify(where)).toContain('expiresAt');
  });

  it('findOneActive répond 404 pour un bon plan non visible', async () => {
    const prisma = { deal: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new DealsService(prisma as never).findOneActive('d1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findActive garde la date de début ET le filtre pays', async () => {
    const prisma = { deal: { findMany: jest.fn().mockResolvedValue([]) } };
    await new DealsService(prisma as never).findActive('GN');
    const where = JSON.stringify(prisma.deal.findMany.mock.calls[0][0].where);
    expect(where).toContain('startsAt');
    expect(where).toContain('expiresAt');
    expect(where).toContain('"countryId":"GN"');
  });

  it('GET /deals/:id : le client passe par findOneActive, la gestion par findOne', async () => {
    const service = { findOne: jest.fn().mockResolvedValue('tout'), findOneActive: jest.fn().mockResolvedValue('visible') };
    const controller = new DealsController(service as never);
    await expect(controller.findOne('d1', { permissions: [] } as never)).resolves.toBe('visible');
    await expect(controller.findOne('d1', { permissions: [PERMISSIONS.PROMOTION_MANAGE] } as never)).resolves.toBe('tout');
  });
});

describe('ArticlesService — visibilité', () => {
  it('findOnePublished filtre sur actif + publié', async () => {
    const prisma = { article: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) } };
    await new ArticlesService(prisma as never).findOnePublished('a1');
    const where = prisma.article.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'a1', isActive: true });
    expect(where.publishedAt).toMatchObject({ not: null });
  });

  it('répond 404 pour un brouillon', async () => {
    const prisma = { article: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new ArticlesService(prisma as never).findOnePublished('a1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /articles/:id : le client passe par findOnePublished, la gestion par findOne', async () => {
    const service = { findOne: jest.fn().mockResolvedValue('tout'), findOnePublished: jest.fn().mockResolvedValue('publié') };
    const controller = new ArticlesController(service as never);
    await expect(controller.findOne('a1', { permissions: [] } as never)).resolves.toBe('publié');
    await expect(controller.findOne('a1', { permissions: [PERMISSIONS.PROMOTION_MANAGE] } as never)).resolves.toBe('tout');
  });
});
