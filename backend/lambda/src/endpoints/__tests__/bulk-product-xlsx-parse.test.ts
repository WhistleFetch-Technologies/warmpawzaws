import {
  BULK_HEADER_FIELD_MAP,
  BULK_TEMPLATE_COLUMN_HEADERS,
  buildBulkProductTemplateBuffer,
  buildBulkProductUpdatedTemplateBuffer,
  bulkRowToTemplateValues,
  getBulkProductTitle,
  parseBulkProductXlsxBuffer,
} from '../bulk-product-xlsx';

describe('getBulkProductTitle', () => {
  it('returns trimmed name', () => {
    expect(getBulkProductTitle({ name: '  Dog Treat  ' })).toBe('Dog Treat');
  });

  it('accepts title alias', () => {
    expect(getBulkProductTitle({ title: 'Cat Toy' })).toBe('Cat Toy');
  });

  it('returns empty string when title is missing or blank', () => {
    expect(getBulkProductTitle({})).toBe('');
    expect(getBulkProductTitle({ name: '   ' })).toBe('');
    expect(getBulkProductTitle({ price: 100 })).toBe('');
  });
});

describe('parseBulkProductXlsxBuffer', () => {
  it('parses only the demo row from the template, ignoring empty tail rows', async () => {
    const buf = await buildBulkProductTemplateBuffer(['Pet Accessories']);
    const { products } = await parseBulkProductXlsxBuffer(buf);

    expect(products).toHaveLength(1);
    expect(getBulkProductTitle(products[0])).toBe('Premium Dog Harness');
    expect(products[0].key_features).toBeTruthy();
  });

  it('maps gallery image column', () => {
    expect(BULK_HEADER_FIELD_MAP.image1000x1000px).toBe('images');
  });

  it('template has 28 unified columns including Warmpawz Product ID', () => {
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toHaveLength(28);
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Delivery Regions');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Warmpawz Product ID');
    const wpidIdx = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Warmpawz Product ID');
    const pgidIdx = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Product Group ID');
    expect(wpidIdx).toBeGreaterThan(-1);
    expect(pgidIdx).toBe(wpidIdx + 1);
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Pet Type');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Listing Ownership*');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).not.toContain('Pet Type Other');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Variant Attribute 1');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Variant Attribute 3');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).not.toContain('Is Default');
  });

  it('maps listing ownership column for bulk upload', () => {
    expect(BULK_HEADER_FIELD_MAP.listingownership).toBe('listing_ownership');
    expect(BULK_HEADER_FIELD_MAP.productownership).toBe('listing_ownership');
  });

  it('maps Warmpawz Product ID column for bulk upload', () => {
    expect(BULK_HEADER_FIELD_MAP.warmpawzproductid).toBe('warmpawz_product_id');
    expect(BULK_HEADER_FIELD_MAP.productid).toBe('warmpawz_product_id');
  });

  it('maps variant attribute columns for bulk upload', () => {
    expect(BULK_HEADER_FIELD_MAP.variantattribute1).toBe('variant_attr_1');
    expect(BULK_HEADER_FIELD_MAP.variantvalue1).toBe('variant_value_1');
    expect(BULK_HEADER_FIELD_MAP.variantattribute3).toBe('variant_attr_3');
    expect(BULK_HEADER_FIELD_MAP.variantvalue3).toBe('variant_value_3');
    expect(BULK_HEADER_FIELD_MAP.productgroupid).toBe('product_group_id');
  });

  it('maps Barcode (EAN) to barcode, not sku', () => {
    expect(BULK_HEADER_FIELD_MAP.barcodeean).toBe('barcode');
    expect(BULK_HEADER_FIELD_MAP.sku).toBeUndefined();
    expect(BULK_HEADER_FIELD_MAP.vendorproductid).toBeUndefined();
  });

  it('demo row parse does not set sku from template', async () => {
    const buf = await buildBulkProductTemplateBuffer(['Pet Accessories']);
    const { products } = await parseBulkProductXlsxBuffer(buf);
    expect(products[0].sku).toBeUndefined();
  });

  it('ignores rows with partial data but no Title', async () => {
    const buf = await buildBulkProductTemplateBuffer(['Pet Accessories']);
    const { products } = await parseBulkProductXlsxBuffer(buf);

    const ghostRows = products.filter((p) => !getBulkProductTitle(p));
    expect(ghostRows).toHaveLength(0);
  });

  it('buildBulkProductUpdatedTemplateBuffer includes Warmpawz Product ID on rows', async () => {
    const buf = await buildBulkProductUpdatedTemplateBuffer([
      {
        name: 'Dog Treat',
        brand: 'Acme',
        category: 'Pet Food',
        stock_quantity: 10,
        images: 'https://example.com/a.jpg',
        price: 99,
        gst_rate: 12,
        hsn_code: '1234',
        warmpawz_product_id: 'prod-uuid-99',
        rowNum: 1,
      },
    ]);
    const { products } = await parseBulkProductXlsxBuffer(buf);
    expect(products).toHaveLength(1);
    expect(products[0].warmpawz_product_id).toBe('prod-uuid-99');
  });

  it('bulkRowToTemplateValues places Warmpawz Product ID before Product Group ID', () => {
    const values = bulkRowToTemplateValues({
      name: 'A',
      warmpawz_product_id: 'id-1',
      product_group_id: 'grp-1',
    });
    const wpidIdx = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Warmpawz Product ID');
    const pgidIdx = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Product Group ID');
    expect(values[wpidIdx]).toBe('id-1');
    expect(values[pgidIdx]).toBe('grp-1');
  });
});

describe('bulk upload title row filter', () => {
  it('filters out untitled rows before validation would run', () => {
    const products = [
      { price: 100, stock_quantity: 10 },
      { name: 'Valid Product', price: 200 },
      { title: '   ' },
    ];
    const titled = products.filter((p) => getBulkProductTitle(p).length > 0);
    expect(titled).toHaveLength(1);
    expect(getBulkProductTitle(titled[0])).toBe('Valid Product');
  });
});
