import { parseAdminCategoryPayloadItem } from '../ecommerce-category-display';

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
  });
});
