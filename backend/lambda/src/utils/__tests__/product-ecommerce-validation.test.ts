import {
  bulkRowLimitResponse,
  countTitledBulkRows,
  exceedsBulkRowLimit,
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
  it('accepts MRP-only and defaults selling to MRP', () => {
    const r = validateEcommerceProductInput(
      { ...validBulkRow, compare_at_price: 500 },
      { mode: 'bulk', validCategoryNames: petFoodCategories },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalized.mrp).toBe(500);
      expect(r.normalized.sellingPrice).toBe(500);
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
});
