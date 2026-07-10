import { parseAdminCategoryPayloadItem, mapCategoryRowForPublic } from '../ecommerce-category-display';

describe('ecommerce-category-display', () => {
  describe('parseAdminCategoryPayloadItem', () => {
    it('maps enabled: false to is_active: false', () => {
      const item = parseAdminCategoryPayloadItem({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Pet Pharmacy',
        enabled: false,
      });
      expect(item.is_active).toBe(false);
      expect(item.name).toBe('Pet Pharmacy');
    });

    it('maps is_active: false when enabled is omitted', () => {
      const item = parseAdminCategoryPayloadItem({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Pet Pharmacy',
        is_active: false,
      });
      expect(item.is_active).toBe(false);
    });

    it('maps enabled: true to is_active: true', () => {
      const item = parseAdminCategoryPayloadItem({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Pet Food',
        enabled: true,
      });
      expect(item.is_active).toBe(true);
    });

    it('defaults is_active to true when neither enabled nor is_active is set', () => {
      const item = parseAdminCategoryPayloadItem({
        name: 'Pet Toys',
      });
      expect(item.is_active).toBe(true);
    });

    it('maps default_commission_rate from payload', () => {
      const item = parseAdminCategoryPayloadItem({
        name: 'Pet Food',
        default_commission_rate: 12,
      });
      expect(item.default_commission_rate).toBe(12);
    });

    it('maps commissionRate alias to default_commission_rate', () => {
      const item = parseAdminCategoryPayloadItem({
        name: 'Pet Food',
        commissionRate: 15,
      });
      expect(item.default_commission_rate).toBe(15);
    });
  });

  describe('mapCategoryRowForPublic', () => {
    it('maps storefront product_count from row', async () => {
      const row = await mapCategoryRowForPublic({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Pet Food',
        product_count: 3,
      });
      expect(row.product_count).toBe(3);
    });

    it('defaults product_count to 0 when missing', async () => {
      const row = await mapCategoryRowForPublic({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Pet Toys',
      });
      expect(row.product_count).toBe(0);
    });
  });
});
