import ExcelJS from 'exceljs';
import {
  BULK_HEADER_FIELD_MAP,
  BULK_TEMPLATE_COLUMN_HEADERS,
  buildBulkProductTemplateBuffer,
  getBulkProductTitle,
  parseBulkProductXlsxBuffer,
  SHEET_NAME,
} from '../bulk-product-xlsx';
import { parseProductImageList } from '../../utils/product-ecommerce-validation';

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
    expect(products[0].pet_type).toBe('dog');
    const demoImages = String(products[0].images ?? '');
    expect(parseProductImageList(demoImages).length).toBeGreaterThanOrEqual(1);
    expect(demoImages).toContain('example.com/your-product-image');
  });

  it('maps gallery image column', () => {
    expect(BULK_HEADER_FIELD_MAP.image1000x1000px).toBe('images');
  });

  it('template has 29 unified columns including lead time and Listing Ownership', () => {
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toHaveLength(29);
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Delivery Regions');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Lead Time Min (days)');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Lead Time Max (days)');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Product Group ID');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Pet Type');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Listing Ownership*');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).not.toContain('Pet Type Other');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Variant Attribute 1');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toContain('Variant Attribute 3');
    expect(BULK_TEMPLATE_COLUMN_HEADERS).not.toContain('Is Default');
  });

  it('maps lead time column aliases', () => {
    expect(BULK_HEADER_FIELD_MAP.leadtimemindays).toBe('lead_time_min_days');
    expect(BULK_HEADER_FIELD_MAP.leadtimemaxdays).toBe('lead_time_max_days');
  });

  it('demo row parse does not set lead time', async () => {
    const buf = await buildBulkProductTemplateBuffer(['Pet Accessories']);
    const { products } = await parseBulkProductXlsxBuffer(buf);
    expect(products[0].lead_time_min_days).toBeUndefined();
    expect(products[0].lead_time_max_days).toBeUndefined();
  });

  it('parses lead time min/max from a filled row', async () => {
    const template = await buildBulkProductTemplateBuffer(['Pet Beds & Furniture']);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(template as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet(SHEET_NAME);
    expect(ws).toBeTruthy();
    const minCol = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Lead Time Min (days)') + 1;
    const maxCol = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Lead Time Max (days)') + 1;
    ws!.getRow(3).getCell(minCol).value = 35;
    ws!.getRow(3).getCell(maxCol).value = 42;
    const out = Buffer.from(await wb.xlsx.writeBuffer());
    const { products } = await parseBulkProductXlsxBuffer(out);
    expect(products[0].lead_time_min_days).toBe('35');
    expect(products[0].lead_time_max_days).toBe('42');
  });

  it('maps listing ownership column for bulk upload', () => {
    expect(BULK_HEADER_FIELD_MAP.listingownership).toBe('listing_ownership');
    expect(BULK_HEADER_FIELD_MAP.productownership).toBe('listing_ownership');
  });

  it('parses Listing Ownership from template demo row onto products', async () => {
    const buf = await buildBulkProductTemplateBuffer(['Pet Accessories']);
    const { products } = await parseBulkProductXlsxBuffer(buf);
    expect(products).toHaveLength(1);
    expect(products[0].listing_ownership).toBe('Third party');
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
