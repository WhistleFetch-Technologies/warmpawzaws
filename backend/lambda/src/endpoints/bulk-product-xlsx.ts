/**
 * XLSX bulk product template — aligned with reference “15 Furries-Dog Dress” / NPI layout.
 * Sheet name: **NPI**. Hidden **Lists** sheet holds dropdown source ranges (Google Sheets–safe).
 */

import ExcelJS from 'exceljs';

/** Matches reference workbook primary sheet name */
export const SHEET_NAME = 'NPI';

const LISTS_SHEET = 'Lists';

/** 46 columns: reference A–AS plus Stock Quantity* after Shelf Life (required by bulk validate). */
export const BULK_TEMPLATE_COLUMN_HEADERS: string[] = [
  'Title*',
  'Description',
  'Key Features',
  'Benefits',
  'Unique Selling Propositions',
  'Brand',
  'Type (Category)',
  'Size (Variant)',
  'Colour',
  'Flavours',
  'Ingredients',
  'Serving or Feeding Recommendations',
  'Barcode (EAN)',
  'Image (1000X1000px)',
  'A+ Content',
  'Size Chart',
  'Weight',
  'Weight Unit(g)',
  'Shelf Life (Days)',
  'Stock Quantity*',
  'SP*',
  'MRP',
  'COGS',
  'Pet Type',
  'Category',
  'Sub Category',
  'Breed Name',
  'Breed Size',
  'Life Stage',
  'Tax',
  'Category L4',
  'Category L5',
  'HSN',
  'Certficate of Authenticity',
  'Vendor Product Id',
  'Country of Origin',
  'Marketed By',
  'Manufactured By',
  'Imported By',
  'Product Lenght in cm or inches',
  'Product Breadth cm or inches',
  'Product Height in cm or inches',
  'Length(mm)',
  'Breadth(mm)',
  'Height(mm)',
  'Casepack Volume',
];

type Fill = ExcelJS.Fill;

const YELLOW: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
};
const HEADER_ROW_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF9CB9C' },
};
const LIGHT_ORANGE: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8CBAD' },
};
const PINK: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' },
};
const PURPLE: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2D5F1' },
};
const GREEN: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6E0B4' },
};
const BLUE: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFBDD7EE' },
};
const TAN: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF4E0C8' },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
};

/** Row 1 merges — 46-column layout (reference + Stock column). */
const ROW1_GROUPS: Array<{ start: number; end: number; title: string; fill: Fill }> = [
  { start: 1, end: 13, title: 'Product Details', fill: YELLOW },
  { start: 14, end: 16, title: 'Picture Information', fill: PINK },
  { start: 17, end: 19, title: 'Other Product Details', fill: PURPLE },
  { start: 20, end: 23, title: 'Pricing Details', fill: PINK },
  { start: 24, end: 34, title: 'Product Brief', fill: GREEN },
  { start: 35, end: 39, title: 'Manufacture Details', fill: LIGHT_ORANGE },
  { start: 40, end: 42, title: 'Product Dimension', fill: BLUE },
  {
    start: 43,
    end: 46,
    title: 'Shipping Dimensions- for Courier charges',
    fill: TAN,
  },
];

/** Columns (1-based) that wrap like the reference */
const WRAP_COL_INDEXES = new Set([3, 4, 15, 16]);

const STATIC_PET_TYPES = ['Dogs', 'Cats', 'Small Pets', 'Birds', 'Fish'];
const STATIC_TAX_LABELS = ['0%', '5%', '12%', '18%', '28%'];

function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function buildSampleRow(sampleCategory: string): string[] {
  const cat = sampleCategory || 'Pet Accessories';
  return [
    'Smiling Sunflower Dog Dress',
    'Bright, happy, and full of joy — smiley flower print.',
    'Design: Smiling Flower\nFabric: Cotton Rayon Blend\nOpening: Drawstrings\nSleeve: Sleeveless',
    '',
    'Dog Dress',
    '15 FURRIES',
    'Dogs-Clothing & Accessories',
    '',
    'Multicolour',
    '',
    '',
    '',
    '',
    'https://drive.google.com/drive/folders/1baR14I-IeqXJC4XZu7SYOlu-rprHvfmB',
    '',
    '',
    '150',
    'g',
    'NA',
    '100',
    '799',
    '1598',
    '',
    'Dogs',
    cat,
    '',
    '',
    '',
    '',
    '5%',
    '',
    '',
    '62052000',
    '',
    '',
    'India',
    'Petfully Yours Pvt Ltd',
    'Apparo Lifestyle Pvt Ltd. 205, A wing, Vasupujya Estate, Goregaon West, Mumbai 400104',
    '',
    '35',
    '25',
    '1',
    '33',
    '27',
    '3',
    '250 grams',
  ];
}

function addListValidations(
  ws: ExcelJS.Worksheet,
  categoryCount: number,
  petRows: number,
  taxRows: number
): void {
  const dv = (
    ws as ExcelJS.Worksheet & {
      dataValidations: { add: (range: string, opts: object) => void };
    }
  ).dataValidations;

  const catEnd = Math.max(1, categoryCount);
  const petEnd = Math.max(1, petRows);
  const taxEnd = Math.max(1, taxRows);

  const catRange = `'${LISTS_SHEET}'!$A$1:$A$${catEnd}`;
  const petRange = `'${LISTS_SHEET}'!$B$1:$B$${petEnd}`;
  const taxRange = `'${LISTS_SHEET}'!$C$1:$C$${taxEnd}`;

  // G = Type (Category), Y = Category — same DB-driven list
  for (const col of ['G', 'Y']) {
    dv.add(`${col}3:${col}500`, {
      type: 'list',
      allowBlank: true,
      formulae: [catRange],
    });
  }

  dv.add(`X3:X500`, {
    type: 'list',
    allowBlank: true,
    formulae: [petRange],
  });

  dv.add(`AC3:AC500`, {
    type: 'list',
    allowBlank: true,
    formulae: [taxRange],
  });
}

/**
 * @param categoryNames deduped display names from ecommerce_categories (active).
 */
export async function buildBulkProductTemplateBuffer(categoryNames: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet(SHEET_NAME);

  const listWs = wb.addWorksheet(LISTS_SHEET, {
    state: 'hidden',
  });

  const cats = categoryNames.filter(Boolean);
  if (cats.length === 0) {
    listWs.getCell(1, 1).value = '(No categories — add in Admin)';
  } else {
    cats.forEach((name, i) => {
      listWs.getCell(i + 1, 1).value = name;
    });
  }

  STATIC_PET_TYPES.forEach((p, i) => {
    listWs.getCell(i + 1, 2).value = p;
  });
  STATIC_TAX_LABELS.forEach((t, i) => {
    listWs.getCell(i + 1, 3).value = t;
  });

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 38;
  ws.getRow(3).height = 80;

  const sampleCategory = cats[0] || 'Pet Accessories';
  const SAMPLE_ROW = buildSampleRow(sampleCategory);

  for (const g of ROW1_GROUPS) {
    ws.mergeCells(`${colLetter(g.start)}1:${colLetter(g.end)}1`);
    const cell = ws.getCell(1, g.start);
    cell.value = g.title;
    cell.fill = g.fill as ExcelJS.Fill;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
  }

  BULK_TEMPLATE_COLUMN_HEADERS.forEach((h, i) => {
    const c = i + 1;
    const cell = ws.getCell(2, c);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.fill = HEADER_ROW_FILL as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
    ws.getColumn(c).width =
      c === 1 ? 52 : c === 3 || c === 4 ? 32 : c === 14 ? 40 : c === 2 ? 36 : 13;
  });

  SAMPLE_ROW.forEach((v, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = v;
    cell.font = { size: 10 };
    cell.alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: WRAP_COL_INDEXES.has(i + 1),
    };
    cell.border = THIN_BORDER as ExcelJS.Borders;
  });

  addListValidations(
    ws,
    cats.length > 0 ? cats.length : 1,
    STATIC_PET_TYPES.length,
    STATIC_TAX_LABELS.length
  );

  const buf = await wb.xlsx.writeBuffer({ useSharedStrings: true });
  return Buffer.from(buf);
}

export function normalizeBulkHeader(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');
}

export const BULK_HEADER_FIELD_MAP: Record<string, string> = {
  name: 'name',
  productname: 'name',
  title: 'name',
  description: 'description',
  desc: 'description',
  keyfeatures: 'key_features',
  benefits: 'benefits',
  uniquesellingpropositions: 'usp',
  uniquesellingproposition: 'usp',
  category: 'category',
  categoryname: 'category',
  typecategory: 'category_type',
  sku: 'sku',
  productsku: 'sku',
  barcodeean: 'sku_barcode',
  vendorproductid: 'vendor_product_id',
  price: 'price',
  sellingprice: 'price',
  sp: 'price',
  mrp: 'compare_at_price',
  compareatprice: 'compare_at_price',
  stock: 'stock_quantity',
  stockquantity: 'stock_quantity',
  quantity: 'stock_quantity',
  inventory: 'stock_quantity',
  hsncode: 'hsn_code',
  hsn: 'hsn_code',
  gstrate: 'gst_rate',
  gst: 'gst_rate',
  tax: 'gst_rate',
  weight: 'weight',
  weightkg: 'weight',
  dimensions: 'dimensions',
  size: 'dimensions',
  sizevariant: 'dimensions_variant',
  material: 'material',
  ingredients: 'material',
  brand: 'brand',
  brandname: 'brand',
  tags: 'tags',
  keywords: 'tags',
  images: 'images',
  imageurls: 'images',
  image: 'images',
  image1000x1000px: 'images',
  isactive: 'is_active',
  active: 'is_active',
  pettype: 'pet_type',
  subcategory: 'sub_category',
  breedname: 'breed_name',
  breedsize: 'breed_size',
  lifestage: 'life_stage',
  categoryl4: 'category_l4',
  categoryl5: 'category_l5',
  colour: 'colour',
  flavours: 'flavours',
  servingorfeedingrecommendations: 'serving',
  servingorfeeding: 'serving',
  certficateofauthenticity: 'certificate',
  productlenghtincmorinches: 'dim_len_cm',
  productlengthincm: 'dim_len_cm',
  productbreadthcmorinches: 'dim_breadth_cm',
  productbreadthcm: 'dim_breadth_cm',
  productheightincmorinches: 'dim_height_cm',
  productheightincm: 'dim_height_cm',
  lengthmm: 'ship_len_mm',
  breadthmm: 'ship_breadth_mm',
  heightmm: 'ship_height_mm',
  casepackvolume: 'casepack_volume',
  countryoforigin: 'country_of_origin',
  marketedby: 'marketed_by',
  manufacturedby: 'manufactured_by',
  importedby: 'imported_by',
};

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null && 'hyperlink' in v) {
    const h = v as ExcelJS.CellHyperlinkValue;
    return String(h.text ?? h.hyperlink ?? '');
  }
  if (typeof v === 'object' && v !== null && 'richText' in v) {
    const rt = (v as { richText?: Array<{ text: string }> }).richText;
    if (Array.isArray(rt)) return rt.map((t) => t.text).join('');
  }
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: string }).text);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseGstPercent(raw: string): number | null {
  const s = raw.trim().replace(/%/g, '');
  let n = parseFloat(s);
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1 && !raw.includes('%')) {
    n = Math.round(n * 10000) / 100;
  }
  return n;
}

function mergeDescriptionParts(base: string, keyFeatures: string, benefits: string): string {
  const parts = [base, keyFeatures, benefits].map((p) => p.trim()).filter(Boolean);
  return parts.join('\n\n');
}

function extraTags(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(', ');
}

export async function parseBulkProductXlsxBuffer(buf: Buffer): Promise<{
  headers: string[];
  products: Record<string, unknown>[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws =
    wb.getWorksheet(SHEET_NAME) ||
    wb.getWorksheet('Products') ||
    wb.worksheets[0];
  if (!ws) {
    throw new Error('Workbook has no worksheets');
  }

  const headerRow = ws.getRow(2);
  let maxCol = BULK_TEMPLATE_COLUMN_HEADERS.length;
  headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
    if (colNumber > maxCol) maxCol = colNumber;
  });

  const internalByCol: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const raw = cellText(headerRow.getCell(c));
    const n = normalizeBulkHeader(raw);
    internalByCol[c - 1] = n ? BULK_HEADER_FIELD_MAP[n] || n : '';
  }

  const products: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 3) return;

    const values: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      values[c - 1] = cellText(row.getCell(c));
    }
    if (values.every((v) => !v.trim())) return;

    const bag: Record<string, string> = {};
    for (let idx = 0; idx < maxCol; idx++) {
      const internalKey = internalByCol[idx];
      if (!internalKey) continue;
      const v = values[idx]?.trim() ?? '';
      if (!v) continue;
      if (!bag[internalKey]) bag[internalKey] = v;
    }

    const name = bag.name || '';
    const description = mergeDescriptionParts(
      bag.description || '',
      bag.key_features || '',
      bag.benefits || ''
    );
    const category =
      bag.category?.trim() || bag.category_type?.trim() || '';
    const sku =
      bag.sku?.trim() || bag.sku_barcode?.trim() || bag.vendor_product_id?.trim() || '';
    const priceRaw = bag.price || '';
    const stockRaw = bag.stock_quantity || '';
    const compareRaw = bag.compare_at_price || '';
    const gstRaw = bag.gst_rate || '';
    const weightRaw = bag.weight || '';

    const dimParts = [
      bag.dimensions_variant,
      bag.dim_len_cm && bag.dim_breadth_cm && bag.dim_height_cm
        ? `${bag.dim_len_cm}x${bag.dim_breadth_cm}x${bag.dim_height_cm}`
        : '',
      bag.ship_len_mm && bag.ship_breadth_mm && bag.ship_height_mm
        ? `ship ${bag.ship_len_mm}x${bag.ship_breadth_mm}x${bag.ship_height_mm} mm`
        : '',
      bag.dimensions,
    ].filter(Boolean);
    const dimensions = dimParts.join(' | ') || bag.dimensions || '';

    const tagPieces = extraTags([
      bag.usp,
      bag.certificate,
      bag.pet_type,
      bag.sub_category,
      bag.breed_name,
      bag.breed_size,
      bag.life_stage,
      bag.category_l4,
      bag.category_l5,
      bag.colour,
      bag.flavours,
      bag.serving,
      bag.country_of_origin,
      bag.marketed_by,
      bag.manufactured_by,
      bag.imported_by,
      bag.casepack_volume,
      bag.tags,
    ]);

    const product: Record<string, unknown> = {};
    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (sku) product.sku = sku;
    if (priceRaw) product.price = parseFloat(String(priceRaw).replace(/,/g, ''));
    if (compareRaw) product.compare_at_price = parseFloat(String(compareRaw).replace(/,/g, ''));
    if (stockRaw) product.stock_quantity = parseFloat(String(stockRaw).replace(/,/g, ''));
    if (bag.hsn_code) product.hsn_code = bag.hsn_code.trim();
    if (gstRaw) {
      const g = parseGstPercent(gstRaw);
      if (g !== null) product.gst_rate = g;
    }
    if (weightRaw) {
      const w = parseFloat(String(weightRaw).replace(/,/g, ''));
      if (!isNaN(w)) product.weight = w;
    }
    if (dimensions) product.dimensions = dimensions;
    if (bag.material) product.material = bag.material.trim();
    if (bag.brand) product.brand = bag.brand.trim();
    if (bag.images) product.images = bag.images.trim();
    if (tagPieces) product.tags = tagPieces;

    products.push(product);
  });

  return { headers: internalByCol, products };
}
