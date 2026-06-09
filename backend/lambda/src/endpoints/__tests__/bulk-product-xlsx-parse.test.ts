import {
  BULK_HEADER_FIELD_MAP,
  BULK_TEMPLATE_COLUMN_HEADERS,
  buildBulkProductTemplateBuffer,
  getBulkProductTitle,
  parseBulkProductXlsxBuffer,
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
    expect(getBulkProductTitle(products[0])).toBe('Smiling Sunflower Dog Dress');
    const demoImages = String(products[0].images ?? '');
    expect(parseProductImageList(demoImages)).toHaveLength(2);
    expect(demoImages).toContain('example.com/your-product-image-2.jpg');
  });

  it('maps A+ Content separately from gallery images', () => {
    expect(BULK_HEADER_FIELD_MAP.acontent).toBe('images_aplus');
    expect(BULK_HEADER_FIELD_MAP.image1000x1000px).toBe('images');
  });

  it('template has 45 columns without Vendor Product Id', () => {
    expect(BULK_TEMPLATE_COLUMN_HEADERS).toHaveLength(45);
    expect(BULK_TEMPLATE_COLUMN_HEADERS).not.toContain('Vendor Product Id');
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
