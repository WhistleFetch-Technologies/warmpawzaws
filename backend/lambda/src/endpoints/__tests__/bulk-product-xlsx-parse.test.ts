import {
  buildBulkProductTemplateBuffer,
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
    expect(getBulkProductTitle(products[0])).toBe('Smiling Sunflower Dog Dress');
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
