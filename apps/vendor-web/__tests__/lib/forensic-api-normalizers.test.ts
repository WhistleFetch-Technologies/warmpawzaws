/**
 * Forensic unit test: Role config normalizer (Phase 1).
 * - normalizeServiceStyleForRoleConfig: unknown -> null (never at_center); labels accepted safely.
 * - normalizeRoleConfig: serviceStyles only canonical; unknown values dropped (Walker stays at_home only).
 */

import {
  normalizeServiceStyleForRoleConfig,
  normalizeRoleConfig,
} from '@/lib/api-normalizers';

describe('forensic: api-normalizers role config (Phase 1)', () => {
  describe('normalizeServiceStyleForRoleConfig', () => {
    it('returns null for unknown values (no default to at_center)', () => {
      expect(normalizeServiceStyleForRoleConfig('unknown')).toBeNull();
      expect(normalizeServiceStyleForRoleConfig('')).toBeNull();
      expect(normalizeServiceStyleForRoleConfig('invalid_style')).toBeNull();
      expect(normalizeServiceStyleForRoleConfig('delivery')).toBeNull();
    });

    it('returns canonical codes for known codes and aliases', () => {
      expect(normalizeServiceStyleForRoleConfig('at_home')).toBe('at_home');
      expect(normalizeServiceStyleForRoleConfig('at_center')).toBe('at_center');
      expect(normalizeServiceStyleForRoleConfig('tele')).toBe('tele');
      expect(normalizeServiceStyleForRoleConfig('at_clinic')).toBe('at_center');
      expect(normalizeServiceStyleForRoleConfig('home_visit')).toBe('at_home');
      expect(normalizeServiceStyleForRoleConfig('video_consultation')).toBe('tele');
    });

    it('accepts labels safely (At Home, At Center, Tele Consultation)', () => {
      expect(normalizeServiceStyleForRoleConfig('At Home')).toBe('at_home');
      expect(normalizeServiceStyleForRoleConfig('At Center')).toBe('at_center');
      expect(normalizeServiceStyleForRoleConfig('Tele Consultation')).toBe('tele');
      expect(normalizeServiceStyleForRoleConfig('at home')).toBe('at_home');
      expect(normalizeServiceStyleForRoleConfig('at center')).toBe('at_center');
    });
  });

  describe('normalizeRoleConfig', () => {
    it('drops unknown values; only canonical codes in serviceStyles (no phantom at_center)', () => {
      const out = normalizeRoleConfig({
        id: 'r1',
        name: 'test',
        serviceStyles: ['at_home', 'unknown', 'At Center'],
      });
      expect(out.serviceStyles).toEqual(['at_home', 'at_center']);
    });

    it('Walker role stays [at_home] only when config has only at_home', () => {
      const out = normalizeRoleConfig({
        id: 'walker-id',
        name: 'walker',
        serviceStyles: ['at_home'],
      });
      expect(out.serviceStyles).toEqual(['at_home']);
    });

    it('prefers top-level serviceStyles from API (canonical)', () => {
      const out = normalizeRoleConfig({
        id: 'r2',
        name: 'groomer',
        serviceStyles: ['at_center', 'at_home'],
        config: { serviceStyles: ['At Center'] },
      });
      expect(out.serviceStyles).toEqual(['at_center', 'at_home']);
    });
  });
});
