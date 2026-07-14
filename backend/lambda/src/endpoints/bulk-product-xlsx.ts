/**
 * XLSX bulk product template — unified 28-column layout for vendor product upload.
 * Single sheet (NPI), inline dropdowns, one demo row.
 *
 * Required (`*`): Title, Brand, Category, Quantity, Image, Price, Tax, HSN
 */
import {
  getBulkProductTitle,
  MAX_BULK_PRODUCT_ROWS,
} from '../utils/product-ecommerce-validation';
import {
  parseDeliveryRegionsCsv,
  getVariantGuideSheetRows,
  PET_TYPE_CUSTOMER_LABEL_ALL_PETS,
  resolveVendorPetTypeInput,
} from '@warmpawz/shared-types';

import ExcelJS from 'exceljs';

export { getBulkProductTitle };

export const SHEET_NAME = 'NPI';
export const VARIANT_GUIDE_SHEET_NAME = 'Variant Guide';

/** 28 columns. Compulsory ones carry a `*` suffix. */
export const BULK_TEMPLATE_COLUMN_HEADERS: string[] = [
  'Title*',
  'Description',
  'Key Features',
  'Brand*',
  'Category*',
  'Product Specifications',
  'Weight (kg)',
  'Product Length (cm)',
  'Product Breadth (cm)',
  'Product Height (cm)',
  'Barcode (EAN)',
  'Quantity*',
  'Image (1000X1000px)*',
  'Price*',
  'Pet Type',
  'Tax*',
  'HSN*',
  'Manufacturing Details',
  'Delivery Regions',
  'Warmpawz Product ID',
  'Product Group ID',
  'Variant Attribute 1',
  'Variant Value 1',
  'Variant Attribute 2',
  'Variant Value 2',
  'Variant Attribute 3',
  'Variant Value 3',
  'Listing Ownership*',
];

const REQUIRED_COL_LETTERS = {
  TITLE: 'A',
  BRAND: 'D',
  CATEGORY: 'E',
  QUANTITY: 'L',
  IMAGE: 'M',
  PRICE: 'N',
  PET_TYPE: 'O',
  TAX: 'P',
  HSN: 'Q',
} as const;

type Fill = ExcelJS.Fill;

const HEADER_ROW_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF9CB9C' },
};
const HEADER_REQUIRED_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF4A460' },
};

const YELLOW: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const GREEN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
const BLUE: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
const TAN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4E0C8' } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
  right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
};

const ROW1_GROUPS: Array<{ start: number; end: number; title: string; fill: Fill }> = [
  {
    start: 1,
    end: 19,
    title: `Product Details (max ${MAX_BULK_PRODUCT_ROWS} rows per file)`,
    fill: YELLOW,
  },
  {
    start: 20,
    end: 28,
    title:
      'Warmpawz Product ID = update existing product. Same Product Group ID within file = one product (variants).',
    fill: TAN,
  },
];

const WRAP_COL_INDEXES = new Set([2, 3, 6, 13, 19]);

const STATIC_PET_TYPES = ['Dog', 'Cat', PET_TYPE_CUSTOMER_LABEL_ALL_PETS];
const STATIC_TAX_LABELS = ['0%', '5%', '12%', '18%', '28%'];

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

function buildSampleRow(sampleCategory: string): string[] {
  const cat = sampleCategory || 'Pet Accessories';
  return [
    'Premium Dog Harness',
    'Comfortable and adjustable harness for everyday walks.',
    'Adjustable straps\nBreathable mesh\nReflective trim',
    'Your Brand Name',
    cat,
    'Material:Nylon, Size:Medium',
    '0.2',
    '25',
    '15',
    '5',
    '',
    '50',
    'https://example.com/your-product-image-1000x1000.jpg',
    '599',
    'Dog',
    '12%',
    '42010000',
    'Country of Origin: India',
    '',
    '', // Warmpawz Product ID — blank for new products
    '', // Product Group ID — upload-scoped variant grouping only
    '', // Variant Attribute 1
    '', // Variant Value 1
    '', // Variant Attribute 2
    '', // Variant Value 2
    '', // Variant Attribute 3
    '', // Variant Value 3
    'Third party',
  ];
}

function buildInlineListFormula(values: string[]): string | null {
  const cleaned = values.map((v) => String(v ?? '').replace(/"/g, '""')).filter((v) => v.length > 0);
  if (cleaned.length === 0) return null;
  const formula = `"${cleaned.join(',')}"`;
  if (formula.length > 255) return null;
  return formula;
}

function addInlineDropdown(ws: ExcelJS.Worksheet, rangeRef: string, values: string[]): void {
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

export async function buildBulkProductTemplateBuffer(categoryNames: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);
  (ws.properties as { dyDescent: number }).dyDescent = 0.25;

  const cats = (categoryNames || []).map((s) => String(s ?? '').trim()).filter(Boolean);
  const categories = cats.length > 0 ? cats : DEFAULT_CATEGORIES;

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 38;
  ws.getRow(3).height = 80;

  const sampleCategory = categories[0] || 'Pet Accessories';
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
    if (c === 1) {
      cell.note =
        'Required (*): Title, Brand, Category, Quantity, Image URL(s), Price, Tax, HSN. Use Product Group ID to group variant rows within this upload.';
    }
    if (h === 'Image (1000X1000px)*') {
      cell.note =
        'One or more direct image URLs, comma-separated. Use stable CDN or website links (not Google Drive view links). Images are shown on the storefront from these URLs.';
    }
    if (h === 'Product Specifications') {
      cell.note = 'Optional. Format: Material:Cotton, Size:Medium';
    }
    if (h === 'Delivery Regions') {
      cell.note = 'Optional. Comma-separated city names. Empty = ships everywhere.';
    }
    if (h === 'Brand*') {
      cell.note = 'Required. Enter your product brand name.';
    }
    if (h === 'Price*') {
      cell.note =
        'Required. The single selling price charged to customers. Commission and promotions are calculated on this price.';
    }
    if (h === 'Pet Type') {
      cell.note =
        'Dog, Cat, All pets, or type a specific pet (e.g. Birds). Leave blank = All pets.';
    }
    if (h === 'Listing Ownership*') {
      cell.note =
        'Required for ownership-model sellers: Own brand or Third party. Optional for category-model sellers.';
    }
    if (h === 'Warmpawz Product ID') {
      cell.note = 'Used only when updating an existing product. Leave blank for new products.';
    }
    if (h === 'Product Group ID') {
      cell.note =
        'Used only to group variant rows within the current upload. This value is not used as the permanent identity.';
    }
    cell.font = { bold: true, size: 10, color: h.includes('*') ? { argb: 'FFFFFFFF' } : undefined };
    cell.fill = (h.includes('*') ? HEADER_REQUIRED_FILL : HEADER_ROW_FILL) as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
    ws.getColumn(c).width =
      c === 1 ? 40 : c === 3 || c === 6 || c === 13 || c === 19 ? 32 : c === 2 ? 28 : 14;
  });

  SAMPLE_ROW.forEach((v, i) => {
    const col = i + 1;
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

  const { CATEGORY, PET_TYPE, TAX } = REQUIRED_COL_LETTERS;
  addInlineDropdown(ws, `${CATEGORY}3:${CATEGORY}500`, categories);
  addInlineDropdown(ws, `${PET_TYPE}3:${PET_TYPE}500`, STATIC_PET_TYPES);
  addInlineDropdown(ws, `${TAX}3:${TAX}500`, STATIC_TAX_LABELS);
  addInlineDropdown(ws, `${colLetter(28)}3:${colLetter(28)}500`, ['Own brand', 'Third party']);

  addVariantGuideSheet(wb);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const VARIANT_GUIDE_HEADERS = [
  'Category',
  'Suggested Attr 1',
  'Suggested Attr 2',
  'Suggested Attr 3',
  'Example combo 1',
  'Example combo 2',
];

function addVariantGuideSheet(wb: ExcelJS.Workbook): void {
  const guideWs = wb.addWorksheet(VARIANT_GUIDE_SHEET_NAME);
  guideWs.getRow(1).height = 28;
  VARIANT_GUIDE_HEADERS.forEach((h, i) => {
    const cell = guideWs.getCell(1, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.fill = HEADER_ROW_FILL as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
    guideWs.getColumn(i + 1).width = i === 0 ? 22 : 28;
  });

  const rows = getVariantGuideSheetRows();
  rows.forEach((row, idx) => {
    const r = idx + 2;
    guideWs.getCell(r, 1).value = row.category;
    guideWs.getCell(r, 2).value = row.attr1;
    guideWs.getCell(r, 3).value = row.attr2;
    guideWs.getCell(r, 4).value = row.attr3;
    guideWs.getCell(r, 5).value = row.example1;
    guideWs.getCell(r, 6).value = row.example2;
    for (let c = 1; c <= 6; c++) {
      const cell = guideWs.getCell(r, c);
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = THIN_BORDER as ExcelJS.Borders;
    }
  });
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
  brand: 'brand',
  brandname: 'brand',
  category: 'category',
  categoryname: 'category',
  typecategory: 'category',
  productspecifications: 'product_specifications',
  specifications: 'product_specifications',
  weightkg: 'weight',
  weight: 'weight',
  productlengthcm: 'length_cm',
  productlenghtincmorinches: 'length_cm',
  productlengthincmorinches: 'length_cm',
  productlengthincm: 'length_cm',
  productbreadthcm: 'breadth_cm',
  productbreadthcmorinches: 'breadth_cm',
  productheightcm: 'height_cm',
  productheightincmorinches: 'height_cm',
  barcodeean: 'barcode',
  barcode: 'barcode',
  stock: 'stock_quantity',
  stockquantity: 'stock_quantity',
  quantity: 'stock_quantity',
  inventory: 'stock_quantity',
  images: 'images',
  imageurls: 'images',
  image: 'images',
  image1000x1000px: 'images',
  price: 'price',
  sellingprice: 'price',
  sp: 'price',
  selling_price: 'price',
  mrp: 'compare_at_price',
  compareatprice: 'compare_at_price',
  pettype: 'pet_type',
  pettypeother: 'pet_type_other',
  tax: 'gst_rate',
  gstrate: 'gst_rate',
  gst: 'gst_rate',
  hsncode: 'hsn_code',
  hsn: 'hsn_code',
  manufacturingdetails: 'manufacturing_details',
  deliveryregions: 'delivery_regions',
  warmpawzproductid: 'warmpawz_product_id',
  productid: 'warmpawz_product_id',
  warmpawzid: 'warmpawz_product_id',
  productgroupid: 'product_group_id',
  variantattribute1: 'variant_attr_1',
  variantvalue1: 'variant_value_1',
  variantattribute2: 'variant_attr_2',
  variantvalue2: 'variant_value_2',
  variantattribute3: 'variant_attr_3',
  variantvalue3: 'variant_value_3',
  listingownership: 'listing_ownership',
  productownership: 'listing_ownership',
  // Legacy 52-column aliases (backward compat for old files)
  benefits: 'benefits',
  uniquesellingpropositions: 'usp',
  colour: 'colour',
  sizevariant: 'dimensions_variant',
  dimlencm: 'length_cm',
  dimbreadthcm: 'breadth_cm',
  dimheightcm: 'height_cm',
  countryoforigin: 'country_of_origin',
  manufacturedby: 'manufactured_by',
};

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

function parseGstPercent(raw: string): number | null {
  const s = raw.trim().replace(/%/g, '');
  let n = parseFloat(s);
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1 && !raw.includes('%')) {
    n = Math.round(n * 10000) / 100;
  }
  return n;
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

    const category = bag.category?.trim() || bag.category_type?.trim() || '';
    const priceRaw = bag.price || '';
    const stockRaw = bag.stock_quantity || '';
    const compareRaw = bag.compare_at_price || '';

    const product: Record<string, unknown> = {};
    product.name = name;
    if (bag.description?.trim()) product.description = bag.description.trim();
    if (bag.key_features?.trim()) product.key_features = bag.key_features.trim();
    if (category) product.category = category;
    if (bag.brand?.trim()) product.brand = bag.brand.trim();
    if (bag.product_specifications?.trim()) {
      product.product_specifications = bag.product_specifications.trim();
    }
    if (bag.barcode?.trim()) product.barcode = bag.barcode.trim();
    if (priceRaw) {
      product.price = parseFloat(String(priceRaw).replace(/,/g, ''));
    } else if (compareRaw) {
      // Legacy bulk column (mrp/compare) maps to single canonical price — never store compare_at_price.
      product.price = parseFloat(String(compareRaw).replace(/,/g, ''));
    }
    if (stockRaw) {
      const s = parseFloat(String(stockRaw).replace(/,/g, ''));
      if (!isNaN(s)) product.stock_quantity = s;
    }
    if (bag.hsn_code?.trim()) product.hsn_code = bag.hsn_code.trim();
    if (bag.gst_rate?.trim()) {
      const g = parseGstPercent(bag.gst_rate);
      if (g !== null) product.gst_rate = g;
    }
    if (bag.weight?.trim()) {
      const w = parseFloat(String(bag.weight).replace(/,/g, ''));
      if (!isNaN(w)) product.weight = w;
    }
    if (bag.length_cm?.trim()) product.length_cm = bag.length_cm.trim();
    if (bag.breadth_cm?.trim()) product.breadth_cm = bag.breadth_cm.trim();
    if (bag.height_cm?.trim()) product.height_cm = bag.height_cm.trim();
    if (bag.images?.trim()) product.images = bag.images.trim();
    const resolvedPet = resolveVendorPetTypeInput(
      bag.pet_type ?? '',
      bag.pet_type_other ?? '',
    );
    if (resolvedPet.pet_type) {
      product.pet_type = resolvedPet.pet_type;
      if (resolvedPet.pet_type_other) {
        product.pet_type_other = resolvedPet.pet_type_other;
      }
    }
    if (bag.manufacturing_details?.trim()) {
      product.manufacturing_details = bag.manufacturing_details.trim();
    }
    if (bag.delivery_regions?.trim()) {
      product.delivery_regions = parseDeliveryRegionsCsv(bag.delivery_regions);
    }
    if (bag.warmpawz_product_id?.trim()) {
      product.warmpawz_product_id = bag.warmpawz_product_id.trim();
    }
    if (bag.product_group_id?.trim()) product.product_group_id = bag.product_group_id.trim();
    if (bag.colour?.trim()) product.colour = bag.colour.trim();
    if (bag.dimensions_variant?.trim()) product.size_variant = bag.dimensions_variant.trim();
    if (bag.variant_attr_1?.trim()) product.variant_attr_1 = bag.variant_attr_1.trim();
    if (bag.variant_value_1?.trim()) product.variant_value_1 = bag.variant_value_1.trim();
    if (bag.variant_attr_2?.trim()) product.variant_attr_2 = bag.variant_attr_2.trim();
    if (bag.variant_value_2?.trim()) product.variant_value_2 = bag.variant_value_2.trim();
    if (bag.variant_attr_3?.trim()) product.variant_attr_3 = bag.variant_attr_3.trim();
    if (bag.variant_value_3?.trim()) product.variant_value_3 = bag.variant_value_3.trim();
    if (bag.listing_ownership?.trim()) {
      product.listing_ownership = bag.listing_ownership.trim();
    }

    products.push(product);
  });

  return { headers: internalByCol, products };
}

function formatGstForTemplate(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  if (n > 0 && n <= 1) return `${Math.round(n * 100)}%`;
  return `${n}%`;
}

function formatDeliveryRegionsForTemplate(raw: unknown): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? '').trim()).filter(Boolean).join(', ');
  return String(raw).trim();
}

/** Map a parsed bulk row (internal field names) to template column order. */
export function bulkRowToTemplateValues(row: Record<string, unknown>): string[] {
  const petType =
    row.pet_type != null && String(row.pet_type).trim()
      ? String(row.pet_type).trim()
      : '';
  return [
    String(row.name ?? ''),
    String(row.description ?? ''),
    String(row.key_features ?? ''),
    String(row.brand ?? ''),
    String(row.category ?? ''),
    String(row.product_specifications ?? ''),
    row.weight != null && row.weight !== '' ? String(row.weight) : '',
    row.length_cm != null && row.length_cm !== '' ? String(row.length_cm) : '',
    row.breadth_cm != null && row.breadth_cm !== '' ? String(row.breadth_cm) : '',
    row.height_cm != null && row.height_cm !== '' ? String(row.height_cm) : '',
    String(row.barcode ?? ''),
    row.stock_quantity != null && row.stock_quantity !== '' ? String(row.stock_quantity) : '',
    String(row.images ?? row.image_urls ?? ''),
    row.price != null && row.price !== '' ? String(row.price) : '',
    petType,
    formatGstForTemplate(row.gst_rate),
    String(row.hsn_code ?? ''),
    String(row.manufacturing_details ?? ''),
    formatDeliveryRegionsForTemplate(row.delivery_regions),
    String(row.warmpawz_product_id ?? ''),
    String(row.product_group_id ?? ''),
    String(row.variant_attr_1 ?? ''),
    String(row.variant_value_1 ?? ''),
    String(row.variant_attr_2 ?? ''),
    String(row.variant_value_2 ?? ''),
    String(row.variant_attr_3 ?? ''),
    String(row.variant_value_3 ?? ''),
    String(row.listing_ownership ?? ''),
  ];
}

/** Build XLSX with uploaded rows and Warmpawz Product ID filled for re-upload. */
export async function buildBulkProductUpdatedTemplateBuffer(
  products: Record<string, unknown>[],
  categoryNames: string[] = [],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);
  (ws.properties as { dyDescent: number }).dyDescent = 0.25;

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 38;

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
    cell.font = { bold: true, size: 10, color: h.includes('*') ? { argb: 'FFFFFFFF' } : undefined };
    cell.fill = (h.includes('*') ? HEADER_REQUIRED_FILL : HEADER_ROW_FILL) as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER as ExcelJS.Borders;
    ws.getColumn(c).width =
      c === 1 ? 40 : c === 3 || c === 6 || c === 13 || c === 19 ? 32 : c === 2 ? 28 : 14;
  });

  const dataRows = products.filter((p) => getBulkProductTitle(p).length > 0);
  dataRows.forEach((row, idx) => {
    const values = bulkRowToTemplateValues(row);
    const r = idx + 3;
    values.forEach((v, colIdx) => {
      const col = colIdx + 1;
      const cell = ws.getCell(r, col);
      cell.value = v;
      cell.font = { size: 10 };
      cell.alignment = {
        vertical: 'top',
        horizontal: 'left',
        wrapText: WRAP_COL_INDEXES.has(col),
      };
      cell.border = THIN_BORDER as ExcelJS.Borders;
    });
  });

  const cats = (categoryNames || []).map((s) => String(s ?? '').trim()).filter(Boolean);
  const categories = cats.length > 0 ? cats : DEFAULT_CATEGORIES;
  const { CATEGORY, PET_TYPE, TAX } = REQUIRED_COL_LETTERS;
  const lastRow = Math.max(3 + dataRows.length - 1, 3);
  addInlineDropdown(ws, `${CATEGORY}3:${CATEGORY}${lastRow}`, categories);
  addInlineDropdown(ws, `${PET_TYPE}3:${PET_TYPE}${lastRow}`, STATIC_PET_TYPES);
  addInlineDropdown(ws, `${TAX}3:${TAX}${lastRow}`, STATIC_TAX_LABELS);
  addInlineDropdown(ws, `${colLetter(28)}3:${colLetter(28)}${lastRow}`, ['Own brand', 'Third party']);

  addVariantGuideSheet(wb);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
