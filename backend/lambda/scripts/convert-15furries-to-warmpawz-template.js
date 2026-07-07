/**
 * Convert 15 Furries listing XLSX → Warmpawz bulk upload template.
 *
 * ROOT CAUSE (see chat/PR notes): Google Drive links — whether a folder link
 * or a direct "uc?export=view" file link — are not reliable for hotlinking on
 * a live website. Google enforces per-file view/bandwidth quotas and bot-traffic
 * detection; once real shop traffic hits the same file repeatedly, Drive serves
 * an HTML interstitial/quota page instead of image bytes, and the <img> tag's
 * onError fires (paw placeholder). A single manual test succeeding proves
 * nothing about production reliability.
 *
 * FIX: Mirror every image to the app's own private S3 uploads bucket (the same
 * bucket vendor-uploaded product photos already live in). The backend already
 * presigns any matching S3 URL at display time (see
 * backend/lambda/src/utils/s3-media-presign.ts), for both the customer shop
 * endpoint (ecommerce.ts) and vendor endpoints (vendor-products.ts). So a raw
 * `https://bucket.s3.region.amazonaws.com/key` URL stored in the bulk template
 * behaves exactly like a normal vendor photo upload — no code changes, no
 * deploy, no DB writes from this script. This script does not call any
 * Warmpawz API or touch RDS; it only (a) reads public Drive files and
 * (b) PUTs plain image objects into the existing dev uploads bucket, then
 * writes the resulting URLs into a downloadable XLSX for the user to bulk
 * upload themselves through the vendor portal.
 *
 * Usage:
 *   node scripts/convert-15furries-to-warmpawz-template.js [--all]
 *   node scripts/convert-15furries-to-warmpawz-template.js [source.xlsx] [template.xlsx] [output.xlsx]
 *
 * Env:
 *   S3_UPLOADS_BUCKET   defaults to warmpawz-dev-user-uploads-057442119249 (dev bucket)
 *   AWS_REGION          defaults to ap-south-1
 */
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ── Edge/Chrome path on Windows (for scraping Drive folder listings) ────────
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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

// Same bucket already used by uploadProductImageBufferToS3() in
// backend/lambda/src/utils/product-s3-image.ts — reusing the app's existing,
// already-trusted image storage instead of inventing a new host.
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-user-uploads-057442119249';
const S3_KEY_PREFIX = 'products/15-furries-bulk-import';

const s3Client = new S3Client({ region: AWS_REGION });

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

// ── Cell reading ─────────────────────────────────────────────────────────────
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

// ── HTTP fetch with redirect following (used both for Drive folder HTML and
//    for downloading actual image bytes) ────────────────────────────────────
function fetchFollow(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) {
      reject(new Error('Too many redirects: ' + url));
      return;
    }
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Accept: '*/*',
        },
        timeout: 30000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(fetchFollow(res.headers.location, depth + 1));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout: ' + url));
    });
  });
}

// ── Google Drive folder → individual file ID extraction (headless browser) ──
const folderFileIdCache = new Map(); // folderId → string[] (file IDs, in DOM order)

function extractFolderIdFromUrl(url) {
  const m = url.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

async function extractFileIdsFromDriveFolder(browser, folderId) {
  if (folderFileIdCache.has(folderId)) return folderFileIdCache.get(folderId);

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
    );

    console.log(`  → Listing Drive folder: ${folderId}`);
    await page.goto(`https://drive.google.com/drive/folders/${folderId}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await page
      .waitForSelector('[data-id], [data-target], .WYuW0e, .KL4PP', { timeout: 15000 })
      .catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));

    const fileIds = await page.evaluate(() => {
      const ids = new Set();
      document.querySelectorAll('[data-id]').forEach((el) => {
        const id = el.getAttribute('data-id');
        if (id && id.length > 20) ids.add(id);
      });
      document.querySelectorAll('a[href]').forEach((el) => {
        const m = el.href.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/);
        if (m) ids.add(m[1]);
      });
      document.querySelectorAll('img[src]').forEach((el) => {
        const src = el.src || '';
        const m1 = src.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]{20,})/);
        if (m1) ids.add(m1[1]);
        const m2 = src.match(/\/thumbnail\?id=([A-Za-z0-9_-]{20,})/);
        if (m2) ids.add(m2[1]);
        const m3 = src.match(/id=([A-Za-z0-9_-]{25,})&/);
        if (m3) ids.add(m3[1]);
      });
      const pageText = document.body.innerHTML;
      const idRe = /"(1[A-Za-z0-9_-]{32,44})"/g;
      for (const m of pageText.matchAll(idRe)) ids.add(m[1]);
      return [...ids];
    });

    const filtered = fileIds.filter((id) => id !== folderId);
    console.log(`    Found ${filtered.length} file(s) in folder`);
    folderFileIdCache.set(folderId, filtered);
    return filtered;
  } catch (e) {
    console.warn(`    Warning: could not list folder ${folderId}: ${e.message}`);
    folderFileIdCache.set(folderId, []);
    return [];
  } finally {
    if (page) await page.close().catch(() => null);
  }
}

// ── Download real bytes for a Drive file and re-host on S3 ──────────────────
const fileIdToS3UrlCache = new Map(); // driveFileId → s3 https url (or null on failure)

function extToContentType(ext) {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function contentTypeToExt(ct) {
  const c = (ct || '').toLowerCase();
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  return 'jpg';
}

function slugifyForKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function mirrorDriveFileToS3(fileId, productSlug, indexInProduct) {
  if (fileIdToS3UrlCache.has(fileId)) return fileIdToS3UrlCache.get(fileId);

  try {
    const r = await fetchFollow(`https://drive.google.com/uc?export=view&id=${fileId}`);
    const contentType = String(r.headers['content-type'] || '');

    if (r.status !== 200 || !contentType.startsWith('image/') || r.body.length === 0) {
      console.warn(
        `    Skip ${fileId}: status=${r.status} contentType=${contentType} bytes=${r.body.length}`
      );
      fileIdToS3UrlCache.set(fileId, null);
      return null;
    }

    const ext = contentTypeToExt(contentType);
    const key = `${S3_KEY_PREFIX}/${productSlug}/${String(indexInProduct).padStart(2, '0')}_${fileId.slice(
      0,
      8
    )}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: r.body,
        ContentType: contentType || extToContentType(ext),
      })
    );

    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    console.log(`    Mirrored ${fileId} → s3://${S3_BUCKET}/${key} (${r.body.length} bytes)`);
    fileIdToS3UrlCache.set(fileId, url);
    return url;
  } catch (e) {
    console.warn(`    Failed to mirror ${fileId}: ${e.message}`);
    fileIdToS3UrlCache.set(fileId, null);
    return null;
  }
}

/** Resolve a Drive folder URL to an ordered list of permanent S3 URLs. */
async function resolveFolderToS3Urls(browser, folderUrl, productSlug) {
  const folderId = extractFolderIdFromUrl(folderUrl);
  if (!folderId) return [folderUrl]; // not a Drive folder link — passthrough

  const fileIds = await extractFileIdsFromDriveFolder(browser, folderId);
  const idsToUse = fileIds.length > 0 ? fileIds : [folderId];

  const urls = [];
  for (let i = 0; i < idsToUse.length; i++) {
    const s3Url = await mirrorDriveFileToS3(idsToUse[i], productSlug, i + 1);
    if (s3Url) urls.push(s3Url);
  }
  return urls;
}

// ── Field helpers ─────────────────────────────────────────────────────────────
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

// ── XLSX readers / writers ────────────────────────────────────────────────────
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

async function toWarmpawzRows(sourceRows, browser) {
  const grouped = groupByTitle(sourceRows);
  const out = [];

  for (const [, variants] of grouped) {
    const first = variants[0];
    const title = String(first.Title ?? '').trim();
    const groupId = slugGroupId(title);
    const hasMultiple = variants.length > 1;
    const productSlug = slugifyForKey(title);

    const colours = new Set(
      variants
        .map((r) => String(r.Colour ?? '').trim())
        .filter((c) => c && c !== '-' && c.toLowerCase() !== 'multicolour')
    );
    const useColorVariant = colours.size > 1;

    const rawImageField = String(first['Image (1000X1000px)'] ?? '').trim();
    let allProductImages = [];

    if (rawImageField) {
      const isDriveFolder = rawImageField.includes('drive.google.com/drive/folders');
      if (isDriveFolder && browser) {
        allProductImages = await resolveFolderToS3Urls(browser, rawImageField, productSlug);
      } else if (/^https?:\/\//.test(rawImageField)) {
        allProductImages = [rawImageField]; // already a direct, non-Drive URL — leave as-is
      }
    }

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

      const warmpawz = {
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

async function convertOne(sourcePath, templatePath, outputPath, browser) {
  console.log('\nReading:', sourcePath);
  const sourceRows = await readSourceRows(sourcePath);
  console.log('15 Furries products (deduped):', sourceRows.length);

  const warmpawzRows = await toWarmpawzRows(sourceRows, browser);
  console.log('Warmpawz output rows:', warmpawzRows.length);

  const withImages = warmpawzRows.filter((r) => r['Image (1000X1000px)*']);
  const withS3 = warmpawzRows.filter(
    (r) => r['Image (1000X1000px)*'] && String(r['Image (1000X1000px)*']).includes('.s3.')
  );
  const noImage = warmpawzRows.filter((r) => !r['Image (1000X1000px)*']);
  console.log(
    `  Images: ${withImages.length}/${warmpawzRows.length} rows have images, ${withS3.length} use permanent S3 URLs, ${noImage.length} have none`
  );
  if (noImage.length > 0) {
    console.log('  Rows with NO image (Drive file may be non-public or non-image):');
    noImage.forEach((r) => console.log('   -', r['Title*']));
  }

  console.log('Writing:', outputPath);
  await writeOutput(templatePath, outputPath, warmpawzRows);
  console.log('Done:', outputPath);
}

async function main() {
  const edgeExists = fs.existsSync(EDGE_PATH);
  const chromeExists = fs.existsSync(CHROME_PATH);
  const executablePath = edgeExists ? EDGE_PATH : chromeExists ? CHROME_PATH : null;

  if (!executablePath) {
    console.warn('Neither Edge nor Chrome found — Drive folders cannot be listed.');
  } else {
    console.log('Using browser for Drive folder listing:', executablePath);
  }
  console.log('S3 mirror target:', `s3://${S3_BUCKET}/${S3_KEY_PREFIX}/... (${AWS_REGION})`);

  let browser = null;
  if (executablePath) {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }

  try {
    const args = process.argv.slice(2);
    if (args[0] === '--all' || args.length === 0) {
      for (const job of DEFAULT_SOURCES) {
        await convertOne(job.input, DEFAULT_TEMPLATE, job.output, browser);
      }
      console.log('\nAll conversions done.');
    } else {
      const sourcePath = args[0];
      const outputPath =
        args[2] ||
        path.join(
          path.dirname(sourcePath),
          `${path.basename(sourcePath, path.extname(sourcePath))}_warmpawz_upload.xlsx`
        );
      await convertOne(sourcePath, args[1] || DEFAULT_TEMPLATE, outputPath, browser);
    }
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
