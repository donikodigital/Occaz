// backend/src/storage/storage-key.util.spec.ts
import { BadRequestException } from '@nestjs/common';
import { assertStorageKeyOwnedBy, isStorageKeyOwnedBy, ownPublicPhotoUrl } from './storage-key.util';

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const DRIVER = 'a1b2c3d4-0000-4000-8000-000000000001';
const OTHER = 'a1b2c3d4-0000-4000-8000-000000000002';

describe('isStorageKeyOwnedBy', () => {
  const owners = [{ folder: 'driver', ownerId: DRIVER }];

  it('accepte une clé fabriquée pour ce propriétaire', () => {
    expect(isStorageKeyOwnedBy(`driver/${DRIVER}/${UUID}.jpg`, owners)).toBe(true);
    expect(isStorageKeyOwnedBy(`driver/${DRIVER}/${UUID}.pdf`, owners)).toBe(true);
  });

  it('refuse la clé d’un autre propriétaire', () => {
    expect(isStorageKeyOwnedBy(`driver/${OTHER}/${UUID}.jpg`, owners)).toBe(false);
  });

  it('refuse un autre dossier (la photo publique d’un utilisateur n’est pas un document)', () => {
    expect(isStorageKeyOwnedBy(`driver-avatar/${DRIVER}/${UUID}.jpg`, owners)).toBe(false);
  });

  it.each([
    `driver/${DRIVER}/../${OTHER}/${UUID}.jpg`,
    `driver/${DRIVER}/${UUID}.exe`,
    `driver/${DRIVER}/mon-fichier.jpg`,
    `/driver/${DRIVER}/${UUID}.jpg`,
    `driver/${DRIVER}/${UUID}.jpg/extra`,
    '',
  ])('refuse %s', (key) => {
    expect(isStorageKeyOwnedBy(key, owners)).toBe(false);
  });

  it('refuse ce qui n’est pas du texte', () => {
    expect(isStorageKeyOwnedBy(undefined, owners)).toBe(false);
    expect(isStorageKeyOwnedBy({ key: 'x' }, owners)).toBe(false);
  });

  it('refuse tout quand il n’y a aucun propriétaire', () => {
    expect(isStorageKeyOwnedBy(`driver/${DRIVER}/${UUID}.jpg`, [])).toBe(false);
  });

  it('accepte l’un OU l’autre de plusieurs propriétaires', () => {
    const both = [...owners, { folder: 'shipment-photo', ownerId: OTHER }];
    expect(isStorageKeyOwnedBy(`shipment-photo/${OTHER}/${UUID}.png`, both)).toBe(true);
  });
});

describe('assertStorageKeyOwnedBy', () => {
  it('renvoie la clé si elle est valide', () => {
    const key = `vehicle/${DRIVER}/${UUID}.webp`;
    expect(assertStorageKeyOwnedBy(key, [{ folder: 'vehicle', ownerId: DRIVER }])).toBe(key);
  });

  it('refuse en 400 sinon', () => {
    expect(() => assertStorageKeyOwnedBy(`vehicle/${OTHER}/${UUID}.webp`, [{ folder: 'vehicle', ownerId: DRIVER }])).toThrow(BadRequestException);
  });
});

describe('ownPublicPhotoUrl', () => {
  const base = 'https://cdn.occaz.sarl';

  it('accepte une photo de notre stockage', () => {
    expect(ownPublicPhotoUrl(`${base}/driver-avatar/x/y.jpg`, base)).toBe(`${base}/driver-avatar/x/y.jpg`);
    expect(ownPublicPhotoUrl(`${base}/a.jpg`, `${base}/`)).toBe(`${base}/a.jpg`);
  });

  it('refuse un lien externe, un faux préfixe ou un chemin remonté', () => {
    expect(ownPublicPhotoUrl('https://evil.example/pixel.png', base)).toBeUndefined();
    expect(ownPublicPhotoUrl('https://cdn.occaz.sarl.evil.example/a.jpg', base)).toBeUndefined();
    expect(ownPublicPhotoUrl(`${base}/../secret.jpg`, base)).toBeUndefined();
  });

  it('ne garde rien sans stockage public configuré ni lien', () => {
    expect(ownPublicPhotoUrl(`${base}/a.jpg`, undefined)).toBeUndefined();
    expect(ownPublicPhotoUrl(undefined, base)).toBeUndefined();
    expect(ownPublicPhotoUrl(null, base)).toBeUndefined();
  });
});
