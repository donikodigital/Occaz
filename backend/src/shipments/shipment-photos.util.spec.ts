// backend/src/shipments/shipment-photos.util.spec.ts
// Photos du colis : 2 au plus, distinctes, et uniquement des clés fabriquées pour le client qui crée l'envoi.
import { BadRequestException } from '@nestjs/common';
import { validateParcelPhotoKeys } from './shipment-photos.util';

const key = (customerId: string, n = 1, ext = 'jpg') => `shipment-photo/${customerId}/0000000${n}-aaaa-bbbb-cccc-dddddddddddd.${ext}`;

describe('validateParcelPhotoKeys', () => {
  it('sans photo : liste vide', () => {
    expect(validateParcelPhotoKeys('c1', undefined)).toEqual([]);
    expect(validateParcelPhotoKeys('c1', [])).toEqual([]);
  });
  it('accepte 1 ou 2 photos du client, dans l\'ordre reçu', () => {
    expect(validateParcelPhotoKeys('c1', [key('c1', 1)])).toEqual([key('c1', 1)]);
    expect(validateParcelPhotoKeys('c1', [key('c1', 2, 'png'), key('c1', 1, 'webp')])).toEqual([key('c1', 2, 'png'), key('c1', 1, 'webp')]);
  });
  it('refuse plus de 2 photos', () => {
    expect(() => validateParcelPhotoKeys('c1', [key('c1', 1), key('c1', 2), key('c1', 3)])).toThrow(BadRequestException);
  });
  it('refuse la photo d\'un autre client', () => {
    expect(() => validateParcelPhotoKeys('c1', [key('c2', 1)])).toThrow(BadRequestException);
  });
  it('refuse un autre dossier, un nom non généré, une extension inconnue ou une remontée de dossier', () => {
    expect(() => validateParcelPhotoKeys('c1', ['documents/c1/0000000a-aaaa-bbbb-cccc-dddddddddddd.jpg'])).toThrow(BadRequestException);
    expect(() => validateParcelPhotoKeys('c1', ['shipment-photo/c1/ma-photo.jpg'])).toThrow(BadRequestException);
    expect(() => validateParcelPhotoKeys('c1', [key('c1', 1, 'pdf')])).toThrow(BadRequestException);
    expect(() => validateParcelPhotoKeys('c1', ['shipment-photo/c1/../c2/00000001-aaaa-bbbb-cccc-dddddddddddd.jpg'])).toThrow(BadRequestException);
  });
  it('refuse la même photo deux fois', () => {
    expect(() => validateParcelPhotoKeys('c1', [key('c1', 1), key('c1', 1)])).toThrow(BadRequestException);
  });
  it('un identifiant client contenant des caractères spéciaux ne casse pas la vérification', () => {
    expect(() => validateParcelPhotoKeys('c.*', [key('cXY', 1)])).toThrow(BadRequestException);
  });
});
