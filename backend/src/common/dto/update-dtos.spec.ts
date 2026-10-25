// backend/src/common/dto/update-dtos.spec.ts
// Les modifications d'actualités / bons plans / codes promo et l'ajout de carte sont désormais réellement validés.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateArticleDto } from '../../articles/dto/update-article.dto';
import { UpdateDealDto } from '../../deals/dto/update-deal.dto';
import { UpdatePromoCodeDto } from '../../promo-codes/dto/update-promo-code.dto';
import { AddSavedCardDto } from '../../saved-cards/dto/add-saved-card.dto';

const errors = async (cls: new () => object, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe('DTO de modification', () => {
  it('acceptent un corps partiel', async () => {
    expect(await errors(UpdateArticleDto, { isActive: false })).toEqual([]);
    expect(await errors(UpdateDealDto, { title: 'Promo' })).toEqual([]);
    expect(await errors(UpdatePromoCodeDto, { isActive: false })).toEqual([]);
  });

  it('refusent une valeur invalide (avant, aucune validation ne s’appliquait)', async () => {
    expect(await errors(UpdateArticleDto, { coverImageUrl: 'pas-un-lien' })).toContain('coverImageUrl');
    expect(await errors(UpdateDealDto, { sortOrder: 'abc' })).toContain('sortOrder');
    expect(await errors(UpdateArticleDto, { isActive: 'oui' })).toContain('isActive');
  });
});

describe('AddSavedCardDto.last4', () => {
  const base = { providerId: 'p', providerToken: 't', expiryMonth: 5, expiryYear: 2030 };
  it('accepte 4 chiffres', async () => {
    expect(await errors(AddSavedCardDto, { ...base, last4: '4242' })).toEqual([]);
  });
  it.each(['424', '42424', 'abcd', '4242 ', '4.42'])('refuse %s', async (last4) => {
    expect(await errors(AddSavedCardDto, { ...base, last4 })).toContain('last4');
  });
});
