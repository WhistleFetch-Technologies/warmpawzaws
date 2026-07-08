/**
 * Convert 15 Furries listing XLSX → Warmpawz bulk upload template.
 *
 * Pure offline conversion utility — does NOT upload images to S3.
 * Image storage is owned exclusively by product-image-ingest.ts at bulk upload.
 *
 * Drive folder links in the supplier Image column are expanded into direct
 * file view URLs (comma-separated in the output template). Bulk upload then
 * downloads, compresses, and stores images under products/{vendorId}/...
 *
 * Usage:
 *   node scripts/convert-15furries-to-warmpawz-template.js [--all] [--use-browser] [--drive-api]
 *   node scripts/convert-15furries-to-warmpawz-template.js [source.xlsx] [template.xlsx] [output.xlsx]
 *
 * Flags:
 *   --use-browser  Fall back to puppeteer-core if HTML fetch finds no file IDs (requires local install)
 *   --drive-api    Use Google Drive API when HTML fetch finds nothing (requires googleapis + service account)
 */
const ExcelJS = require('exceljs');
const path = require('path');
const {
  isDriveFolderUrl,
  parseDriveOptions,
  resolveFolderToDirectUrls,
} = require('./lib/drive-folder-to-urls');

const DEFAULT_SOURCES = [
  {
    input: 'C:/Users/Ketan Hirani/Downloads/15 Furries-Dog Dress.xlsx',
    output: 'C:/Users/Ketan Hirani/Downloads/15_furries_dog_dress_warmpawz_upload.xlsx',
  },
  {
    input: 'C:/Users/Ketan Hirani/Downloads/15 Furries -Cotton Shirts.xlsx',
    output: 'C:/Users/Ketan Hirani/Downloads/15_furries_cotton_shirts_warmpawz_upload.xlsx',
  },
  {
    input: 'C:/Users/Ketan Hirani/Downloads/15 Furries- T Shirts.xlsx',
    output: 'C:/Users/Ketan Hirani/Downloads/15_furries_t_shirts_warmpawz_upload.xlsx',
  },
];

const DEFAULT_TEMPLATE = 'C:/Users/Ketan Hirani/Downloads/product_upload_template.xlsx';

const BRAND = '15 Furries';
const CATEGORY = 'Pet Clothing';
const LISTING_OWNERSHIP = 'Own brand';
const DEFAULT_STOCK = 100;

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
    if ('richText' in v && Array.isArray(v.richText))
      return v.richText.map((t) => t.text).join('').trim();
    if ('text' in v) return String(v.text).trim();
    return String(v).trim();
  }
  return String(v).trim();
}

function slugGroupId(title) {
  return `15F-${String(title)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)}`;
}

function normalizePetType(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'dogs' || s === 'dog') return 'Dog';
  if (s === 'cats' || s === 'cat') return 'Cat';
  return raw ? String(raw).trim() : 'Dog';
}

function formatTax(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '5%';
  if (s.includes('%')) return s;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return '5%';
  if (n > 0 && n <= 1) return `${Math.round(n * 100)}%`;
  return `${n}%`;
}

function gramsToKg(weightRaw, unitRaw) {
  const w = parseFloat(String(weightRaw ?? '').replace(/,/g, ''));
  if (!Number.isFinite(w) || w <= 0) return '';
  const unit = String(unitRaw ?? 'g').trim().toLowerCase();
  if (unit === 'kg' || unit === 'kgs') return String(w);
  return String(Math.round((w / 1000) * 1000) / 1000);
}

function buildManufacturingDetails(row) {
  const parts = [];
  const origin = String(row['Country of Origin'] ?? '').trim();
  const mfg = String(row['Manufactured By'] ?? '').trim();
  const marketed = String(row['Marketed By'] ?? '').trim();
  if (origin) parts.push(`Country of Origin: ${origin}`);
  if (mfg && mfg !== '-') parts.push(`Manufactured By: ${mfg}`);
  if (marketed && marketed !== '-') parts.push(`Marketed By: ${marketed}`);
  return parts.join('\n');
}

function buildProductSpecs(row) {
  const parts = [];
  const usp = String(row['Unique Selling Propositions'] ?? '').trim();
  const typeCat = String(row['Type (Category)'] ?? '').trim();
  if (usp && usp !== '-') parts.push(`Type:${usp}`);
  if (typeCat) parts.push(`Category:${typeCat}`);
  return parts.join(', ');
}

function parsePrice(row) {
  const sp = parseFloat(String(row.SP ?? '').replace(/,/g, ''));
  const mrp = parseFloat(String(row.MRP ?? '').replace(/,/g, ''));
  if (Number.isFinite(sp) && sp > 0) return sp;
  if (Number.isFinite(mrp) && mrp > 0) return mrp;
  return '';
}

function is15FurriesRow(row) {
  const brand = String(row.Brand ?? '').trim().toLowerCase();
  const title = String(row.Title ?? '').trim();
  if (!title) return false;
  return brand.includes('15') && brand.includes('furri');
}

function rowDedupeKey(row) {
  return [row.Title, row['Size (Variant)'], row.Colour, row.MRP, row.SP, row['Barcode (EAN)']]
    .map((v) => String(v ?? '').trim().toLowerCase())
    .join('|');
}

function inferSizeVariantValue(row, variants) {
  const size = String(row['Size (Variant)'] ?? '').trim();
  if (size && size !== '-' && !/^\d+g$/i.test(size)) return size;
  if (variants.length <= 1) return '';
  const sorted = [...variants].sort((a, b) => parsePrice(a) - parsePrice(b));
  const idx = sorted.findIndex((r) => rowDedupeKey(r) === rowDedupeKey(row));
  const labels = ['Small', 'Medium', 'Large', 'X-Large', 'XX-Large'];
  return labels[idx] !== undefined ? labels[idx] : `Size ${idx + 1}`;
}

function groupByTitle(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.Title ?? '').trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function readSourceRows(sourcePath) {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile(sourcePath).then(() => {
    const ws = wb.worksheets[0];
    const headers = [];
    ws.getRow(2).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col] = cellText(cell);
    });
    const seen = new Set();
    const rows = [];
    ws.eachRow((row, rn) => {
      if (rn < 3) return;
      const bag = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (headers[col]) bag[headers[col]] = cellText(cell);
      });
      if (!is15FurriesRow(bag)) return;
      const key = rowDedupeKey(bag);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(bag);
    });
    return rows;
  });
}

async function resolveImageField(rawImageField, driveOptions) {
  const raw = String(rawImageField ?? '').trim();
  if (!raw) return [];

  if (isDriveFolderUrl(raw)) {
    return resolveFolderToDirectUrls(raw, driveOptions);
  }
  if (/^https?:\/\//i.test(raw)) {
    return [raw];
  }
  return [];
}

async function toWarmpawzRows(sourceRows, driveOptions) {
  const grouped = groupByTitle(sourceRows);
  const out = [];

  for (const [, variants] of grouped) {
    const first = variants[0];
    const title = String(first.Title ?? '').trim();
    const groupId = slugGroupId(title);
    const hasMultiple = variants.length > 1;

    const colours = new Set(
      variants
        .map((r) => String(r.Colour ?? '').trim())
        .filter((c) => c && c !== '-' && c.toLowerCase() !== 'multicolour'),
    );
    const useColorVariant = colours.size > 1;

    const rawImageField = String(first['Image (1000X1000px)'] ?? '').trim();
    const allProductImages = await resolveImageField(rawImageField, driveOptions);

    for (let i = 0; i < variants.length; i++) {
      const row = variants[i];
      const sizeValue = hasMultiple ? inferSizeVariantValue(row, variants) : '';
      const colour = String(row.Colour ?? '').trim();
      const colourValue = useColorVariant && colour && colour !== '-' ? colour : '';

      let assignedImages;
      if (allProductImages.length === 0) {
        assignedImages = '';
      } else if (allProductImages.length >= variants.length) {
        if (i === 0) {
          const extras = allProductImages.slice(variants.length);
          assignedImages = [allProductImages[0], ...extras].join(', ');
        } else {
          assignedImages = allProductImages[i];
        }
      } else {
        assignedImages = allProductImages.join(', ');
      }

      out.push({
        'Title*': title,
        Description: String(row.Description ?? '').trim(),
        'Key Features': String(row['Key Features'] ?? '').trim(),
        'Brand*': BRAND,
        'Category*': CATEGORY,
        'Product Specifications': buildProductSpecs(row),
        'Weight (kg)': gramsToKg(row.Weight, row['Weight Unit(g)']),
        'Product Length (cm)': String(row['Product Lenght in cm or inches'] ?? '').trim(),
        'Product Breadth (cm)': String(row['Product Breadth cm or inches'] ?? '').trim(),
        'Product Height (cm)': String(row['Product Height in cm or inches'] ?? '').trim(),
        'Barcode (EAN)': String(row['Barcode (EAN)'] ?? '').trim(),
        'Quantity*': DEFAULT_STOCK,
        'Image (1000X1000px)*': assignedImages,
        'Price*': parsePrice(row),
        'Pet Type': normalizePetType(row['Pet Type']),
        'Tax*': formatTax(row.Tax),
        'HSN*': String(row.HSN ?? '').trim(),
        'Manufacturing Details': buildManufacturingDetails(row),
        'Delivery Regions': '',
        'Product Group ID': hasMultiple ? groupId : '',
        'Variant Attribute 1': hasMultiple && sizeValue ? 'Size' : '',
        'Variant Value 1': hasMultiple && sizeValue ? sizeValue : '',
        'Variant Attribute 2': hasMultiple && colourValue ? 'Color' : '',
        'Variant Value 2': hasMultiple && colourValue ? colourValue : '',
        'Variant Attribute 3': '',
        'Variant Value 3': '',
        'Listing Ownership*': LISTING_OWNERSHIP,
      });
    }
  }

  return out;
}

async function writeOutput(templatePath, outputPath, rows) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('NPI') || wb.worksheets[0];

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

function logImageStats(warmpawzRows) {
  const withImages = warmpawzRows.filter((r) => r['Image (1000X1000px)*']);
  const noImage = warmpawzRows.filter((r) => !r['Image (1000X1000px)*']);
  const withDriveFileUrls = warmpawzRows.filter((r) =>
    String(r['Image (1000X1000px)*'] || '').includes('drive.google.com/uc?export=view'),
  );
  const withFolderUrls = warmpawzRows.filter((r) =>
    String(r['Image (1000X1000px)*'] || '').includes('drive.google.com/drive/folders'),
  );
  const withS3Urls = warmpawzRows.filter((r) =>
    String(r['Image (1000X1000px)*'] || '').includes('.s3.'),
  );

  console.log(
    `  Images: ${withImages.length}/${warmpawzRows.length} rows have URLs, ${withDriveFileUrls.length} use Drive file links, ${noImage.length} have none`,
  );
  if (withFolderUrls.length > 0) {
    console.warn(`  WARNING: ${withFolderUrls.length} row(s) still contain Drive folder URLs`);
  }
  if (withS3Urls.length > 0) {
    console.warn(`  WARNING: ${withS3Urls.length} row(s) contain S3 URLs (should be external only)`);
  }
  if (noImage.length > 0) {
    console.log('  Rows with NO image (folder may need --use-browser or --drive-api):');
    noImage.forEach((r) => console.log('   -', r['Title*']));
  }
}

async function convertOne(sourcePath, templatePath, outputPath, driveOptions) {
  console.log('\nReading:', sourcePath);
  const sourceRows = await readSourceRows(sourcePath);
  console.log('15 Furries products (deduped):', sourceRows.length);

  const warmpawzRows = await toWarmpawzRows(sourceRows, driveOptions);
  console.log('Warmpawz output rows:', warmpawzRows.length);
  logImageStats(warmpawzRows);

  console.log('Writing:', outputPath);
  await writeOutput(templatePath, outputPath, warmpawzRows);
  console.log('Done:', outputPath);
}

async function main() {
  const argv = process.argv.slice(2);
  const driveOptions = parseDriveOptions(argv);
  const positional = argv.filter((a) => !a.startsWith('--'));

  if (driveOptions.useBrowser) {
    console.log('Browser fallback enabled (--use-browser)');
  }
  if (driveOptions.useDriveApi) {
    console.log('Drive API tier enabled (--drive-api)');
  }
  console.log('Image mode: external URLs only (S3 ingestion happens at bulk upload)');

  if (positional[0] === '--all' || positional.length === 0) {
    for (const job of DEFAULT_SOURCES) {
      await convertOne(job.input, DEFAULT_TEMPLATE, job.output, driveOptions);
    }
    console.log('\nAll conversions done.');
  } else {
    const sourcePath = positional[0];
    const outputPath =
      positional[2] ||
      path.join(
        path.dirname(sourcePath),
        `${path.basename(sourcePath, path.extname(sourcePath))}_warmpawz_upload.xlsx`,
      );
    await convertOne(sourcePath, positional[1] || DEFAULT_TEMPLATE, outputPath, driveOptions);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
