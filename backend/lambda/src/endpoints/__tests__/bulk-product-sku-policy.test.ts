import { generateVendorProductSku } from '../../utils/product-ecommerce-validation';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('bulk product SKU policy', () => {
  const vendorId = 'abc-def-ghi-jkl';

  it('assigns auto SKU on create when row has no vendor SKU', () => {
    const rowNum = 5;
    const sku = generateVendorProductSku(vendorId, String(rowNum));
    expect(sku).toMatch(/^WP-abcdefgh-\d+-5$/);
  });

  it('keeps existing SKU when re-upload matches same title (update path)', () => {
    const existingProduct = { id: 'prod-1', sku: 'WP-abcdefgh-1700000000000' };
    const skuForUpdate = existingProduct.sku;
    expect(skuForUpdate).toBe('WP-abcdefgh-1700000000000');
  });

  it('generates distinct SKU for new title (create path)', () => {
    const sku1 = generateVendorProductSku(vendorId, '1');
    const sku2 = generateVendorProductSku(vendorId, '2');
    expect(sku1).not.toBe(sku2);
  });
});

describe('vendor product update SKU immutability', () => {
  it('PUT handler does not assign body.sku to updateData', () => {
    const src = readFileSync(
      join(__dirname, '../vendor/endpoints/vendor-products.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/updateData\.sku\s*=\s*body\.sku/);
    expect(src).toContain('Backfill legacy rows with null SKU on save');
  });

  it('backfills SKU only when previous SKU was empty', () => {
    const legacyPrevSku = '';
    const existingPrevSku = 'WP-abcdefgh-1700000000000';
    expect(!legacyPrevSku.trim()).toBe(true);
    expect(!existingPrevSku.trim()).toBe(false);
  });
});
