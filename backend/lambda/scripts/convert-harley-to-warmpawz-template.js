/**
 * Convert Harley's Corner listing XLSX → Warmpawz bulk upload template.
 *
 * Usage:
 *   node scripts/convert-harley-to-warmpawz-template.js [harleyPath] [templatePath] [outputPath]
 */
const ExcelJS = require('exceljs');
const path = require('path');

const DEFAULT_HARLEY =
  "C:/Users/Ketan Hirani/Downloads/Harley's Corner - Warmpawz Product Listing Data.xlsx";
const DEFAULT_TEMPLATE =
  'C:/Users/Ketan Hirani/Downloads/product_upload_template.xlsx';
const DEFAULT_OUTPUT =
  "C:/Users/Ketan Hirani/Downloads/harleys_corner_warmpawz_upload.xlsx";

const BRAND = "Harley's Corner";
const CATEGORY = 'Pet Food';
const PET_TYPE = 'Dog';
const TAX = '12%';
const HSN = '23091000'; // prepared pet food — adjust if vendor uses different HSN
const LISTING_OWNERSHIP = 'Own brand';
const DEFAULT_STOCK = 100;
const MANUFACTURING = 'Country of Origin: India';

const WARM_HEADERS = [
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
  'Product Group ID',
  'Variant Attribute 1',
  'Variant Value 1',
  'Variant Attribute 2',
  'Variant Value 2',
  'Variant Attribute 3',
  'Variant Value 3',
  'Listing Ownership*',
];

function cellText(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null) {
    if ('formula' in v) return cellText({ value: v.result });
    if ('hyperlink' in v) return String(v.text ?? v.hyperlink ?? '').trim();
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join('').trim();
    }
    if ('text' in v) return String(v.text).trim();
    return String(v).trim();
  }
  return String(v).trim();
}

function slugGroupId(name) {
  return `HC-${String(name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}`;
}

function collectImageUrls(row) {
  const urls = [];
  for (const [key, val] of Object.entries(row)) {
    if (!key.includes('media_location')) continue;
    const u = String(val ?? '').trim();
    if (u && /^https?:\/\//i.test(u)) urls.push(u);
  }
  return [...new Set(urls)];
}

function buildTitle(name, mealType) {
  const n = String(name ?? '').trim();
  const mt = String(mealType ?? '').trim();
  if (!mt || mt.toLowerCase() === 'everyday meals') return n;
  return `${n} (${mt})`;
}

function readHarleyRows(harleyPath) {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile(harleyPath).then(() => {
    const ws = wb.worksheets[0];
    const headers = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col] = cellText(cell);
    });

    const rows = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return;
      const bag = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        bag[headers[col]] = cellText(cell);
      });
      if (!bag.Name?.trim()) return;
      rows.push(bag);
    });
    return rows;
  });
}

function groupHarleyRows(rows) {
  /** @type {Map<string, typeof rows>} */
  const map = new Map();
  for (const row of rows) {
    const key = String(row.Name ?? '').trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function toWarmpawzRows(harleyRows) {
  const grouped = groupHarleyRows(harleyRows);
  const out = [];

  for (const [, variants] of grouped) {
    const first = variants[0];
    const name = String(first.Name ?? '').trim();
    const groupId = slugGroupId(name);
    const hasMultiplePacks = variants.length > 1;

    for (const row of variants) {
      const images = collectImageUrls(row);
      const pack = String(row['Packing Size'] ?? '').trim();
      const mealType = String(row['Meal Type'] ?? '').trim();
      const mrp = parseFloat(String(row['MRP ( Rs)'] ?? '').replace(/,/g, ''));
      const sku = String(row.SKU ?? '').trim();

      const warmpawz = {
        'Title*': buildTitle(name, mealType),
        Description: String(row.DESCRIPTION ?? '').trim(),
        'Key Features': mealType ? `Meal Type: ${mealType}` : '',
        'Brand*': BRAND,
        'Category*': CATEGORY,
        'Product Specifications': pack ? `Pack:${pack}` : '',
        'Weight (kg)': '',
        'Product Length (cm)': '',
        'Product Breadth (cm)': '',
        'Product Height (cm)': '',
        'Barcode (EAN)': sku,
        'Quantity*': DEFAULT_STOCK,
        'Image (1000X1000px)*': images.join(', '),
        'Price*': Number.isFinite(mrp) && mrp > 0 ? mrp : '',
        'Pet Type': PET_TYPE,
        'Tax*': TAX,
        'HSN*': HSN,
        'Manufacturing Details': MANUFACTURING,
        'Delivery Regions': '',
        'Product Group ID': hasMultiplePacks ? groupId : '',
        'Variant Attribute 1': hasMultiplePacks ? 'Pack' : '',
        'Variant Value 1': hasMultiplePacks ? pack : '',
        'Variant Attribute 2': '',
        'Variant Value 2': '',
        'Variant Attribute 3': '',
        'Variant Value 3': '',
        'Listing Ownership*': LISTING_OWNERSHIP,
      };

      out.push(warmpawz);
    }
  }

  return out;
}

async function writeOutput(templatePath, outputPath, rows) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('NPI') || wb.worksheets[0];

  // Clear demo data from row 3 onward
  const lastRow = ws.rowCount;
  for (let r = 3; r <= lastRow; r++) {
    ws.getRow(r).values = [];
  }

  let rowNum = 3;
  for (const row of rows) {
    const excelRow = ws.getRow(rowNum);
    WARM_HEADERS.forEach((header, idx) => {
      const val = row[header];
      if (val !== '' && val != null) {
        excelRow.getCell(idx + 1).value = val;
      }
    });
    rowNum++;
  }

  await wb.xlsx.writeFile(outputPath);
}

async function validateWithParser(outputPath) {
  const fs = require('fs');
  const buf = fs.readFileSync(outputPath);
  // Use compiled TS if available; fall back to manual check
  try {
    const { parseBulkProductXlsxBuffer } = require('../dist/endpoints/bulk-product-xlsx');
    const parsed = await parseBulkProductXlsxBuffer(buf);
    const products = parsed.products;
    const withImages = products.filter((p) => p.images && String(p.images).includes('http'));
    const withTitle = products.filter((p) => p.name);
    console.log('Parse check: rows=', products.length, 'titled=', withTitle.length, 'withImages=', withImages.length);
    if (products[0]) {
      console.log('Sample row 1 images type:', typeof products[0].images, String(products[0].images).slice(0, 80));
    }
    return products;
  } catch (e) {
    console.log('Parse module not built; skipping API parse test:', e.message);
    return null;
  }
}

async function main() {
  const harleyPath = process.argv[2] || DEFAULT_HARLEY;
  const templatePath = process.argv[3] || DEFAULT_TEMPLATE;
  const outputPath = process.argv[4] || DEFAULT_OUTPUT;

  console.log('Reading Harley file:', harleyPath);
  const harleyRows = await readHarleyRows(harleyPath);
  console.log('Harley products:', harleyRows.length);

  const grouped = groupHarleyRows(harleyRows);
  const multiPack = [...grouped.entries()].filter(([, v]) => v.length > 1);
  console.log('Products with multiple pack variants:', multiPack.length);
  multiPack.forEach(([name, v]) => {
    console.log(' -', name, ':', v.map((r) => r['Packing Size']).join(', '));
  });

  const warmpawzRows = toWarmpawzRows(harleyRows);
  console.log('Warmpawz output rows:', warmpawzRows.length);

  console.log('Writing:', outputPath);
  await writeOutput(templatePath, outputPath, warmpawzRows);
  await validateWithParser(outputPath);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
