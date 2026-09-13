// backend/src/common/utils/duration.util.spec.ts
import { addDuration, parseDurationToMs } from './duration.util';

describe('duration.util', () => {
  describe('parseDurationToMs', () => {
    it('parse les secondes', () => {
      expect(parseDurationToMs('300s')).toBe(300 * 1000);
    });

    it('parse les minutes', () => {
      expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
    });

    it('parse les heures', () => {
      expect(parseDurationToMs('2h')).toBe(2 * 60 * 60 * 1000);
    });

    it('parse les jours', () => {
      expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('tolère les espaces autour de la valeur', () => {
      expect(parseDurationToMs(' 15m ')).toBe(15 * 60 * 1000);
    });

    it('rejette une unité inconnue', () => {
      expect(() => parseDurationToMs('15x')).toThrow();
    });

    it('rejette un format sans unité', () => {
      expect(() => parseDurationToMs('15')).toThrow();
    });

    it('rejette une chaîne vide', () => {
      expect(() => parseDurationToMs('')).toThrow();
    });
  });

  describe('addDuration', () => {
    it('ajoute la durée à une date de référence donnée', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const result = addDuration('30d', from);
      expect(result.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    it("utilise l'instant présent par défaut si aucune date de référence n'est fournie", () => {
      const before = Date.now();
      const result = addDuration('1h');
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
      expect(result.getTime()).toBeLessThanOrEqual(after + 60 * 60 * 1000);
    });
  });
});
