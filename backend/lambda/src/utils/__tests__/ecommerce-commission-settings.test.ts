import {
  normalizeCommissionRate,
  parseSellerRateOverride,
  buildCommissionSettingsResponse,
} from '../ecommerce-commission-settings';

describe('ecommerce-commission-settings', () => {
  describe('parseSellerRateOverride', () => {
    it('parses flat number', () => {
      expect(parseSellerRateOverride(12)).toBe(12);
    });

    it('parses object with default key', () => {
      expect(parseSellerRateOverride({ default: 11 })).toBe(11);
    });

    it('returns null for invalid', () => {
      expect(parseSellerRateOverride(null)).toBeNull();
      expect(parseSellerRateOverride(150)).toBeNull();
    });
  });

  describe('buildCommissionSettingsResponse', () => {
    it('maps DB row to API shape', () => {
      const res = buildCommissionSettingsResponse({
        default_rate: 15,
        rules: [],
        seller_rates: { 'v-1': 10 },
      });
      expect(res.defaultRate).toBe(15);
      expect(res.sellerRates).toEqual({ 'v-1': 10 });
    });
  });

  describe('normalizeCommissionRate', () => {
    it('clamps valid rates', () => {
      expect(normalizeCommissionRate('12.5')).toBe(12.5);
    });
  });
});
