/**
 * XLSX bulk product template (styled) and parser for vendor bulk upload.
 */

import ExcelJS from 'exceljs';

const SHEET_NAME = 'Products';

/** Row 2 headers (display); * = required in validate/upload */
export const BULK_TEMPLATE_COLUMN_HEADERS: string[] = [
  'Title*',
  'Description',
  'Key Features',
  'Benefits',
  'Unique Selling Proposition',
  'Brand',
  'Type (Category)',
  'Size (Variant)',
  'Colour',
  'Flavours',
  'Ingredients',
  'Serving or Feeding',
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
  'Certificate of Auth',
  'Vendor Product Id',
  'Country of Origin',
  'Marketed By',
  'Manufactured By',
  'Imported By',
  'Product Length in cm',
  'Product Breadth cm',
  'Product Height in cm',
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
const PEACH: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFCE4D6' },
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
  fgColor: { argb: 'FFFCE4D6' },
};

/** Merged row-1 groups: startCol, endCol (1-based), title, fill */
const ROW1_GROUPS: Array<{ start: number; end: number; title: string; fill: Fill }> = [
  { start: 1, end: 4, title: 'Product Details', fill: YELLOW },
  { start: 5, end: 13, title: 'Product Information', fill: YELLOW },
  { start: 14, end: 16, title: 'Picture Information', fill: PINK },
  { start: 17, end: 19, title: 'Other Product Details', fill: PURPLE },
  { start: 20, end: 23, title: 'Pricing Details', fill: PINK },
  { start: 24, end: 32, title: 'Product Brief', fill: GREEN },
  { start: 33, end: 35, title: 'Vendor / Origin', fill: LIGHT_ORANGE },
  { start: 36, end: 38, title: 'Manufacture Details', fill: LIGHT_ORANGE },
  { start: 39, end: 41, title: 'Product Dimension', fill: BLUE },
  { start: 42, end: 46, title: 'Shipping Dimensions (courier)', fill: TAN },
];

const WRAP_COL_INDEXES = new Set([3, 4, 15, 16]); // Key Features, Benefits, A+, Size Chart (1-based)

const SAMPLE_ROW: string[] = [
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
  'https://drive.google.com/drive/folders/example',
  '',
  '',
  '150',
  'g',
  'NA',
  '100',
  '799',
  '999',
  '',
  'Dogs',
  'Non-Food',
  '',
  '',
  '',
  '',
  '5%',
  '',
  '',
  '12052000',
  '',
  '',
  'India',
  'Petfully Yours Pvt Ltd',
  'Apparo Lifestyle Pvt Ltd, Mumbai',
  '',
  '35',
  '25',
  '1',
  '33',
  '27',
  '2',
  '250 grams',
];

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

export async function buildBulkProductTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  for (const g of ROW1_GROUPS) {
    ws.mergeCells(`${colLetter(g.start)}1:${colLetter(g.end)}1`);
    const cell = ws.getCell(1, g.start);
    cell.value = g.title;
    cell.fill = g.fill as ExcelJS.Fill;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  BULK_TEMPLATE_COLUMN_HEADERS.forEach((h, i) => {
    const c = i + 1;
    const cell = ws.getCell(2, c);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = PEACH as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.getColumn(c).width = c === 3 || c === 4 ? 28 : c === 14 ? 36 : 14;
  });

  SAMPLE_ROW.forEach((v, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = v;
    cell.alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: WRAP_COL_INDEXES.has(i + 1),
    };
  });

  const dv = (ws as ExcelJS.Worksheet & { dataValidations: { add: (range: string, opts: object) => void } }).dataValidations;
  dv.add(`X4:X500`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"Dogs,Cats,Small Pets,Birds,Fish"'],
    showErrorMessage: true,
    errorTitle: 'Pet Type',
    error: 'Choose a value from the list.',
  });
  dv.add(`Y4:Y500`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"Food,Non-Food,Services"'],
    showErrorMessage: true,
    errorTitle: 'Category',
    error: 'Choose a value from the list.',
  });
  dv.add(`AD4:AD500`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"0%,5%,12%,18%,28%"'],
    showErrorMessage: true,
    errorTitle: 'Tax',
    error: 'Choose GST % from the list.',
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Normalize header label for field mapping (matches CSV path). */
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

/** Map normalized header -> internal product key (or alias consumed later). */
export const BULK_HEADER_FIELD_MAP: Record<string, string> = {
  name: 'name',
  productname: 'name',
  title: 'name',
  description: 'description',
  desc: 'description',
  keyfeatures: 'key_features',
  benefits: 'benefits',
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
  servingorfeeding: 'serving',
  productlengthincm: 'dim_len_cm',
  productbreadthcm: 'dim_breadth_cm',
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
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n;
}

function mergeDescriptionParts(base: string, keyFeatures: string, benefits: string): string {
  const parts = [base, keyFeatures, benefits].map((p) => p.trim()).filter(Boolean);
  return parts.join('\n\n');
}

function extraTags(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(', ');
}

/**
 * Parse uploaded workbook: row 1 = groups, row 2 = headers, row 3+ = data.
 */
export async function parseBulkProductXlsxBuffer(buf: Buffer): Promise<{
  headers: string[];
  products: Record<string, unknown>[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(SHEET_NAME) || wb.worksheets[0];
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

    const name =
      bag.name ||
      bag.title ||
      '';
    const description = mergeDescriptionParts(
      bag.description || '',
      bag.key_features || '',
      bag.benefits || ''
    );
    const category = bag.category?.trim() || bag.category_type?.trim() || '';
    const sku =
      bag.sku?.trim() ||
      bag.sku_barcode?.trim() ||
      bag.vendor_product_id?.trim() ||
      '';
    const priceRaw = bag.price || '';
    const stockRaw = bag.stock_quantity || '';
    const compareRaw = bag.compare_at_price || '';
    const gstRaw = bag.gst_rate || '';
    const weightRaw = bag.weight || '';

    const dimParts = [
      bag.dimensions_variant,
      bag.dim_len_cm && bag.dim_breadth_cm && bag.dim_height_cm
        ? `${bag.dim_len_cm}x${bag.dim_breadth_cm}x${bag.dim_height_cm} cm`
        : '',
      bag.ship_len_mm && bag.ship_breadth_mm && bag.ship_height_mm
        ? `ship ${bag.ship_len_mm}x${bag.ship_breadth_mm}x${bag.ship_height_mm} mm`
        : '',
      bag.dimensions,
    ].filter(Boolean);
    const dimensions = dimParts.join(' | ') || bag.dimensions || '';

    const tagPieces = extraTags([
      bag.usp,
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
    if (priceRaw) product.price = parseFloat(priceRaw.replace(/,/g, ''));
    if (compareRaw) product.compare_at_price = parseFloat(compareRaw.replace(/,/g, ''));
    if (stockRaw) product.stock_quantity = parseFloat(stockRaw.replace(/,/g, ''));
    if (bag.hsn_code) product.hsn_code = bag.hsn_code.trim();
    if (gstRaw) {
      const g = parseGstPercent(gstRaw);
      if (g !== null) product.gst_rate = g;
    }
    if (weightRaw) {
      const w = parseFloat(weightRaw.replace(/,/g, ''));
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
