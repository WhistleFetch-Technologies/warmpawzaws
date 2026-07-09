import {
  bulkRowLimitResponse,
  collectFragileImageWarnings,
  countTitledBulkRows,
  exceedsBulkRowLimit,
  generateVendorProductSku,
  isFragileProductImageUrl,
  MAX_BULK_PRODUCT_ROWS,
  parseProductImageList,
  validateEcommerceProductInput,
} from '../product-ecommerce-validation';

const validBulkRow = {
  name: 'Dog Treat',
  compare_at_price: 199,
  stock_quantity: 10,
  category: 'Pet Food',
  hsn_code: '23091000',
  gst_rate: 5,
  images: 'https://cdn.example.com/a.jpg',
};

const petFoodCategories = new Set(['pet food', 'pet accessories']);

describe('product-ecommerce-validation', () => {
  it('accepts compare_at_price as the canonical price (single-price model)', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, compare_at_price: 500 },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalized.price).toBe(500);
    }
  });

  it('rejects missing HSN', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, hsn_code: '' },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('hsn_code');
  });

  it('rejects invalid GST slab', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, gst_rate: 15 },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('gst_rate');
  });

  it('rejects missing image', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, images: '' },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('images');
  });

  it('rejects unknown category on bulk', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, category: 'Unknown Cat' },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('category');
  });

  it('single mode requires category_id and accepts data URL images', () => {
    const r = validateEcommerceProductInput(
      {
        name: 'Cat Toy',
        compare_at_price: 100,
        stock: 5,
        category_id: 'uuid-1',
        hsn_code: '950300',
        gst_rate: 18,
        images: ['data:image/png;base64,abc'],
      },
      {
        mode: 'single',
        resolvedCategoryName: 'Pet Toys',
        requireHttpImageUrls: false,
      },
    );
    expect(r.ok).toBe(true);
  });

  it('countTitledBulkRows and limit at 501', () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({
      name: `Product ${i}`,
    }));
    expect(countTitledBulkRows(rows)).toBe(501);
    expect(exceedsBulkRowLimit(rows)).toBe(true);
    const err = bulkRowLimitResponse(501);
    expect(err.limit).toBe(MAX_BULK_PRODUCT_ROWS);
    expect(err.count).toBe(501);
    expect(err.error).toContain('501');
  });

  it('parseProductImageList splits comma-separated URLs', () => {
    expect(
      parseProductImageList('https://a.com/1.jpg, https://b.com/2.jpg'),
    ).toEqual(['https://a.com/1.jpg', 'https://b.com/2.jpg']);
  });

  it('accepts comma-separated bulk images', () => {
    const r = validateEcommerceProductInput(
      {
        ...validBulkRow,
        images: 'https://cdn.example.com/a.jpg, https://cdn.example.com/b.jpg',
      },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.imageUrls).toHaveLength(2);
  });

  it('rejects bulk image cell with invalid URL among valid ones', () => {
    const r = validateEcommerceProductInput(
      {
        ...validBulkRow,
        images: 'https://cdn.example.com/a.jpg, not-a-url',
      },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('images');
  });

  it('rejects empty or comma-only image cell', () => {
    expect(
      validateEcommerceProductInput(
        { ...validBulkRow, images: '  ,  , ' },
        { mode: 'bulk', validCategoryNames: petFoodCategories },
      ).ok,
    ).toBe(false);
  });

  it('generateVendorProductSku matches WP-{8chars}-{digits} format', () => {
    const vendorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const sku = generateVendorProductSku(vendorId);
    expect(sku).toMatch(/^WP-a1b2c3d4-\d+$/);
  });

  it('generateVendorProductSku appends unique suffix for bulk rows', () => {
    const vendorId = 'vendor-uuid-1234';
    const sku = generateVendorProductSku(vendorId, '42');
    expect(sku).toMatch(/^WP-vendoruu-\d+-42$/);
  });

  it('does not normalize vendor-supplied sku or vendor_product_id', () => {
    const r = validateEcommerceProductInput(
      {
        ...validBulkRow,
        sku: 'VENDOR-SKU-001',
        vendor_product_id: 'VPI-999',
      },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('sku' in r.normalized).toBe(false);
    }
  });

  it('flags Google Drive and Dropbox URLs as fragile', () => {
    expect(isFragileProductImageUrl('https://drive.google.com/file/d/abc/view')).toBe(true);
    expect(isFragileProductImageUrl('https://www.dropbox.com/s/abc/photo.jpg')).toBe(true);
    expect(isFragileProductImageUrl('https://cdn.vendor.com/product.jpg')).toBe(false);
  });

  it('collectFragileImageWarnings returns non-blocking warnings per fragile URL', () => {
    const warnings = collectFragileImageWarnings({
      images:
        'https://cdn.example.com/ok.jpg, https://drive.google.com/file/d/x/view',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe('images');
    expect(warnings[0].value).toContain('drive.google.com');
  });
});
