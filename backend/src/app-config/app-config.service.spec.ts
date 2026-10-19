// backend/src/app-config/app-config.service.spec.ts
import { AppConfigService, sanitizeUrl, sanitizeVersion } from './app-config.service';

describe('sanitizeVersion', () => {
  it.each([['1.4.0', '1.4.0'], ['2', '2'], [' 1.2 ', '1.2']])('« %s » => %s', (input, expected) => expect(sanitizeVersion(input)).toBe(expected));
  it.each([[undefined], [null], [12], ['abc'], ['1.2.3.4'], ['1.2.x'], ['<script>'], ['']])('%p => 0.0.0 (aucune exigence)', (input) => expect(sanitizeVersion(input)).toBe('0.0.0'));
});

describe('sanitizeUrl', () => {
  it('accepte https, refuse le reste', () => {
    expect(sanitizeUrl('https://play.google.com/store/apps/details?id=sarl.occaz')).toContain('https://play.google.com');
    expect(sanitizeUrl('http://exemple.test')).toBeNull();
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl(42)).toBeNull();
  });
});

describe('AppConfigService.getPublicConfig', () => {
  it('lit les réglages et nettoie les valeurs', async () => {
    const prisma = { platformSetting: { findMany: jest.fn().mockResolvedValue([
      { key: 'app.min_version', value: '1.5.0' },
      { key: 'app.update_url_android', value: 'https://play.google.com/x' },
      { key: 'app.update_url_ios', value: 'ftp://nope' },
    ]) } };
    await expect(new AppConfigService(prisma as never).getPublicConfig()).resolves.toEqual({
      minVersion: '1.5.0', updateUrlAndroid: 'https://play.google.com/x', updateUrlIos: null,
      features: { sosSms: false, phoneChange: true },
    });
  });
  it('sans réglage : aucune exigence', async () => {
    const prisma = { platformSetting: { findMany: jest.fn().mockResolvedValue([]) } };
    await expect(new AppConfigService(prisma as never).getPublicConfig()).resolves.toEqual({ minVersion: '0.0.0', updateUrlAndroid: null, updateUrlIos: null, features: { sosSms: false, phoneChange: true } });
  });
  it('SMS_EXTRA_PURPOSES réactive le SOS dans les fonctions annoncées ; le changement de numéro est ouvert par défaut', async () => {
    process.env.SMS_EXTRA_PURPOSES = 'SOS';
    try {
      const prisma = { platformSetting: { findMany: jest.fn().mockResolvedValue([]) } };
      await expect(new AppConfigService(prisma as never).getPublicConfig()).resolves.toMatchObject({ features: { sosSms: true, phoneChange: true } });
    } finally {
      delete process.env.SMS_EXTRA_PURPOSES;
    }
  });
});
