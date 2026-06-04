/**
 * XLSX bulk product template — based on the “15 Furries-Dog Dress” / NPI reference,
 * extended with a `Quantity*` column inside **Product Details** so vendors can ship
 * sellable rows in one upload. Single visible sheet (`NPI`), inline data validation
 * lists (Google-Sheets compatible), one demo row pre-filled with valid values.
 *
 * 46-column layout (1-based):
 *   A–N  (1–14)  Product Details                      ← Title*, …, Barcode (EAN), Quantity*
 *   O–Q  (15–17) Picture Information                  ← Image*, A+ Content, Size Chart
 *   R–T  (18–20) Other Product Details                ← Weight, Weight Unit, Shelf Life
 *   U–W  (21–23) Pricing Details                      ← SP (optional), MRP*, COGS
 *   X–AH (24–34) Product Brief                        ← Pet Type, Category* (=IF(Grow="","",Grow) in new templates), …, Tax*, …, HSN*, Cert
 *   AI–AM(35–39) Manufacture Details
 *   AN–AP(40–42) Product Dimension                    ← Length/Breadth/Height (cm)
 *   AQ–AT(43–46) Shipping Dimensions + Casepack Vol.
 *
 * Required (`*`) columns enforced by `bulk-product-upload.ts` validator:
 *   Title*, Quantity*, Image*, MRP*, Category*, Tax*, HSN* (max 500 titled rows per file)
 */
import {
  getBulkProductTitle,
  MAX_BULK_PRODUCT_ROWS,
} from '../utils/product-ecommerce-validation';

import ExcelJS from 'exceljs';

export { getBulkProductTitle };

/** Matches reference workbook primary sheet name */
export const SHEET_NAME = 'NPI';

/** 46 columns. Compulsory ones carry a `*` suffix in the visible header. */
export const BULK_TEMPLATE_COLUMN_HEADERS: string[] = [
  // Product Details (A–N, 14 cols)
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
  'Quantity*',
  // Picture Information (O–Q, 3 cols)
  'Image (1000X1000px)*',
  'A+ Content',
  'Size Chart',
  // Other Product Details (R–T, 3 cols)
  'Weight',
  'Weight Unit(g)',
  'Shelf Life (Days)',
  // Pricing Details (U–W, 3 cols)
  'SP',
  'MRP*',
  'COGS',
  // Product Brief (X–AH, 11 cols)
  'Pet Type',
  'Category*',
  'Sub Category',
  'Breed Name',
  'Breed Size',
  'Life Stage',
  'Tax*',
  'Category L4',
  'Category L5',
  'HSN*',
  'Certficate of Authenticity',
  // Manufacture Details (AI–AM, 5 cols)
  'Vendor Product Id',
  'Country of Origin',
  'Marketed By',
  'Manufactured By',
  'Imported By',
  // Product Dimension (AN–AP, 3 cols)
  'Product Lenght in cm or inches',
  'Product Breadth cm or inches',
  'Product Height in cm or inches',
  // Shipping Dimensions (AQ–AT, 4 cols)
  'Length(mm)',
  'Breadth(mm)',
  'Height(mm)',
  'Casepack Volume',
];

/** Column letters for the seven mandatory inputs — used for validation DV ranges. */
const REQUIRED_COL_LETTERS = {
  TITLE: 'A',
  QUANTITY: 'N',
  IMAGE: 'O',
  TYPE_CATEGORY: 'G',
  PET_TYPE: 'X',
  CATEGORY: 'Y',
  TAX: 'AD',
  HSN: 'AG',
  MRP: 'V',
} as const;

/** 1-based column index for Category* — same letter as REQUIRED_COL_LETTERS.CATEGORY. */
const BULK_TEMPLATE_CATEGORY_STAR_COL = BULK_TEMPLATE_COLUMN_HEADERS.indexOf('Category*') + 1;

type Fill = ExcelJS.Fill;

const HEADER_ROW_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF9CB9C' },
};
/** Required-column header gets a slightly stronger orange so vendors spot the `*` columns. */
const HEADER_REQUIRED_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF4A460' },
};

const YELLOW: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const PINK: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
const PURPLE: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2D5F1' } };
const LIGHT_ORANGE: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
const GREEN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
const BLUE: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
const TAN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4E0C8' } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
};

/** Row 1 merged group titles — 46-column layout (Quantity added to Product Details). */
const ROW1_GROUPS: Array<{ start: number; end: number; title: string; fill: Fill }> = [
  {
    start: 1,
    end: 14,
    title: `Product Details (max ${MAX_BULK_PRODUCT_ROWS} products per file)`,
    fill: YELLOW,
  },
  { start: 15, end: 17, title: 'Picture Information', fill: PINK },
  { start: 18, end: 20, title: 'Other Product Details', fill: PURPLE },
  { start: 21, end: 23, title: 'Pricing Details', fill: PINK },
  { start: 24, end: 34, title: 'Product Brief', fill: GREEN },
  { start: 35, end: 39, title: 'Manufacture Details', fill: LIGHT_ORANGE },
  { start: 40, end: 42, title: 'Product Dimension', fill: BLUE },
  { start: 43, end: 46, title: 'Shipping Dimensions- for Courier charges', fill: TAN },
];

/** Wide free-text columns that should wrap. */
const WRAP_COL_INDEXES = new Set([3, 4, 15, 16]);

const STATIC_PET_TYPES = ['Dogs', 'Cats', 'Small Pets', 'Birds', 'Fish'];
const STATIC_TAX_LABELS = ['0%', '5%', '12%', '18%', '28%'];

/**
 * Built-in fallback so the template still has a useful Category dropdown even if
 * the DB returns nothing (network blip, fresh stage, etc.). Keep aligned with
 * the seed data in `admin-advanced.ts` (`Pet Food`, `Pet Accessories`, …).
 */
const DEFAULT_CATEGORIES = [
  'Pet Food',
  'Pet Accessories',
  'Pet Toys',
  'Pet Grooming',
  'Pet Health',
  'Pet Beds & Furniture',
  'Pet Clothing',
  'Pet Travel',
  'Pet Pharmacy',
  'Pet Training',
];

/**
 * One fully-valid demo row covering every required (`*`) field plus a few
 * optional ones — gives vendors a copy-pasteable example of correct values.
 */
function buildSampleRow(sampleCategory: string): string[] {
  const cat = sampleCategory || 'Pet Accessories';
  return [
    // Product Details
    'Smiling Sunflower Dog Dress',                                  // 1  Title*
    'Bright, happy, and full of joy — smiley flower print.',        // 2  Description
    'Design: Smiling Flower\nFabric: Cotton Rayon Blend\nOpening: Drawstrings\nSleeve: Sleeveless', // 3  Key Features
    '',                                                              // 4  Benefits
    'Dog Dress',                                                     // 5  USP
    '15 FURRIES',                                                    // 6  Brand
    cat,                                                             // 7  Type (Category)
    '',                                                              // 8  Size (Variant)
    'Multicolour',                                                   // 9  Colour
    '',                                                              // 10 Flavours
    '',                                                              // 11 Ingredients
    '',                                                              // 12 Serving / Feeding
    '',                                                              // 13 Barcode (EAN)
    '100',                                                           // 14 Quantity*
    // Picture Information
    'https://example.com/your-product-image-1000x1000.jpg',          // 15 Image*
    '',                                                              // 16 A+ Content
    '',                                                              // 17 Size Chart
    // Other Product Details
    '150',                                                           // 18 Weight
    'g',                                                             // 19 Weight Unit
    'NA',                                                            // 20 Shelf Life
    // Pricing Details
    '799',                                                           // 21 SP*
    '1598',                                                          // 22 MRP
    '',                                                              // 23 COGS
    // Product Brief
    'Dogs',                                                          // 24 Pet Type
    cat,                                                             // 25 Category*
    '',                                                              // 26 Sub Category
    '',                                                              // 27 Breed Name
    '',                                                              // 28 Breed Size
    '',                                                              // 29 Life Stage
    '5%',                                                            // 30 Tax*
    '',                                                              // 31 Category L4
    '',                                                              // 32 Category L5
    '62052000',                                                      // 33 HSN*
    '',                                                              // 34 Certificate
    // Manufacture Details
    'VPI-001',                                                       // 35 Vendor Product Id
    'India',                                                         // 36 Country of Origin
    'Petfully Yours Pvt Ltd',                                        // 37 Marketed By
    'Apparo Lifestyle Pvt Ltd. 205, A wing, Vasupujya Estate, Goregaon West, Mumbai 400104', // 38 Manufactured By
    '',                                                              // 39 Imported By
    // Product Dimension (cm)
    '35',                                                            // 40 Length cm
    '25',                                                            // 41 Breadth cm
    '1',                                                             // 42 Height cm
    // Shipping Dimensions (mm)
    '33',                                                            // 43 Length mm
    '27',                                                            // 44 Breadth mm
    '3',                                                             // 45 Height mm
    '250 grams',                                                     // 46 Casepack Volume
  ];
}

/**
 * Excel/Google Sheets accept inline list formulae of the form `"a,b,c"`. The
 * spec limit is 255 characters total for the formula string. We escape any
 * embedded double-quote with `""` and skip values whose final length exceeds
 * the limit (caller falls back to a free-text cell — preferable to a broken
 * dropdown that can prevent the file from opening).
 */
function buildInlineListFormula(values: string[]): string | null {
  const cleaned = values.map((v) => String(v ?? '').replace(/"/g, '""')).filter((v) => v.length > 0);
  if (cleaned.length === 0) return null;
  const formula = `"${cleaned.join(',')}"`;
  if (formula.length > 255) return null;
  return formula;
}

function addInlineDropdown(
  ws: ExcelJS.Worksheet,
  rangeRef: string,
  values: string[]
): void {
  const formula = buildInlineListFormula(values);
  if (!formula) return;
  (
    ws as ExcelJS.Worksheet & {
      dataValidations: { add: (range: string, opts: object) => void };
    }
  ).dataValidations.add(rangeRef, {
    type: 'list',
    allowBlank: true,
    showErrorMessage: false,
    formulae: [formula],
  });
}

/**
 * @param categoryNames deduped display names from ecommerce_categories (active).
 *   Falls back to DEFAULT_CATEGORIES if empty so the template is always usable.
 */
export async function buildBulkProductTemplateBuffer(categoryNames: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);

  // ExcelJS 4.4 ships with `properties.dyDescent = 55` (a known bug) which
  // emits `<sheetFormatPr x14ac:dyDescent="55"/>`. The valid range is small
  // floats (~0.25). This nonsense value is one of the reasons Google Sheets
  // refuses to open the file with “File could not open. Try refreshing.”.
  // Overwriting it before write makes the workbook valid for both Excel and
  // Google Sheets / docs.google.com import.
  (ws.properties as { dyDescent: number }).dyDescent = 0.25;

  const cats = (categoryNames || []).map((s) => String(s ?? '').trim()).filter(Boolean);
  const categories = cats.length > 0 ? cats : DEFAULT_CATEGORIES;

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 38;
  ws.getRow(3).height = 80;

  const sampleCategory = categories[0] || 'Pet Accessories';
  const SAMPLE_ROW = buildSampleRow(sampleCategory);

  // Row 1 — group headers
  for (const g of ROW1_GROUPS) {
    ws.mergeCells(`${colLetter(g.start)}1:${colLetter(g.end)}1`);
    const cell = ws.getCell(1, g.start);
    cell.value = g.title;
    cell.fill = g.fill as ExcelJS.Fill;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
  }

  // Row 2 — column headers (required ones get a stronger fill so vendors notice the `*`).
  BULK_TEMPLATE_COLUMN_HEADERS.forEach((h, i) => {
    const c = i + 1;
    const cell = ws.getCell(2, c);
    cell.value = h;
    if (c === 1) {
      cell.note =
        'Required (*): Title, Quantity, Image URL, MRP, Category (column Y), Tax, HSN. SP optional. Use Category* not Type (Category). Recommend Vendor Product Id. Max 500 titled rows per upload.';
    }
    cell.font = { bold: true, size: 10, color: h.includes('*') ? { argb: 'FFFFFFFF' } : undefined };
    cell.fill = (h.includes('*') ? HEADER_REQUIRED_FILL : HEADER_ROW_FILL) as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
    ws.getColumn(c).width =
      c === 1 ? 52 : c === 3 || c === 4 ? 32 : c === 15 ? 40 : c === 2 ? 36 : 13;
  });

  // Row 3 — single demo row. Category* mirrors Type (Category) via formula (rows 3–500).
  const typeCatLetter = REQUIRED_COL_LETTERS.TYPE_CATEGORY;
  const categoryMirrorFormula = (row: number) =>
    `IF(${typeCatLetter}${row}="","",${typeCatLetter}${row})`;

  SAMPLE_ROW.forEach((v, i) => {
    const col = i + 1;
    if (col === BULK_TEMPLATE_CATEGORY_STAR_COL) return;
    const cell = ws.getCell(3, col);
    cell.value = v;
    cell.font = { size: 10 };
    cell.alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: WRAP_COL_INDEXES.has(col),
    };
    cell.border = THIN_BORDER as ExcelJS.Borders;
  });
  const yDemo = ws.getCell(3, BULK_TEMPLATE_CATEGORY_STAR_COL);
  yDemo.value = { formula: categoryMirrorFormula(3) };
  yDemo.font = { size: 10 };
  yDemo.alignment = { vertical: 'top', horizontal: 'left', wrapText: false };
  yDemo.border = THIN_BORDER as ExcelJS.Borders;

  for (let r = 4; r <= 500; r++) {
    const c = ws.getCell(r, BULK_TEMPLATE_CATEGORY_STAR_COL);
    c.value = { formula: categoryMirrorFormula(r) };
    c.font = { size: 10 };
    c.alignment = { vertical: 'top', horizontal: 'left', wrapText: false };
  }

  // Dropdowns — letters track REQUIRED_COL_LETTERS (unchanged; list on Y still works alongside formula).
  const { TYPE_CATEGORY, PET_TYPE, CATEGORY, TAX } = REQUIRED_COL_LETTERS;
  addInlineDropdown(ws, `${TYPE_CATEGORY}3:${TYPE_CATEGORY}500`, categories);
  addInlineDropdown(ws, `${CATEGORY}3:${CATEGORY}500`, categories);
  addInlineDropdown(ws, `${PET_TYPE}3:${PET_TYPE}500`, STATIC_PET_TYPES);
  addInlineDropdown(ws, `${TAX}3:${TAX}500`, STATIC_TAX_LABELS);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

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
  selling_price: 'price',
  mrp: 'compare_at_price',
  compareatprice: 'compare_at_price',
  cogs: 'cogs',
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
  weightunitg: 'weight_unit',
  shelflifedays: 'shelf_life_days',
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
  acontent: 'images_aplus',
  sizechart: 'size_chart',
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
  certificateofauthenticity: 'certificate',
  productlenghtincmorinches: 'dim_len_cm',
  productlengthincmorinches: 'dim_len_cm',
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

/**
 * Reads display text from a stored cell value, including formula cached `result`
 * when Excel saved the workbook after calculation.
 */
function cellValueToDisplayString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null && 'formula' in v) {
    const f = v as { result?: ExcelJS.CellValue };
    if (f.result !== undefined && f.result !== null) {
      return cellValueToDisplayString(f.result);
    }
    return '';
  }
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

function cellText(cell: ExcelJS.Cell): string {
  return cellValueToDisplayString(cell.value as ExcelJS.CellValue);
}

/**
 * Tax column may arrive as `"5%"`, `"5"`, `"0.05"`, etc. Returns the percent
 * value (5, 12, 18, …) — or `null` if unparseable.
 */
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

function extraTags(parts: Array<string | undefined>): string {
  return parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(', ');
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
    if (!name.trim()) return;

    const description = mergeDescriptionParts(
      bag.description || '',
      bag.key_features || '',
      bag.benefits || ''
    );
    // Prefer the user-facing "Category" (col Y) over the legacy "Type (Category)" (col G).
    const category = bag.category?.trim() || bag.category_type?.trim() || '';
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
    // Quantity is now a required column. Leave undefined here when missing so
    // the validator can flag it; only coerce numeric strings.
    if (stockRaw) {
      const s = parseFloat(String(stockRaw).replace(/,/g, ''));
      if (!isNaN(s)) product.stock_quantity = s;
    }
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
