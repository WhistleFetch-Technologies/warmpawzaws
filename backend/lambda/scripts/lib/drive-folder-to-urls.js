/**
 * Expand a Google Drive folder link into direct file view URLs for bulk upload.
 *
 * Tier 1 (default): HTTP fetch + HTML regex (no extra dependencies)
 * Tier 2 (optional): Google Drive API when --drive-api + service account env set
 * Tier 3 (opt-in):   Headless browser when --use-browser and prior tiers find nothing
 *
 * Output URLs: https://drive.google.com/uc?export=view&id={FILE_ID}
 * S3 ingestion is handled later by product-image-ingest.ts at bulk upload time.
 */
const https = require('https');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const folderFileIdCache = new Map();

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
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
        timeout: 30000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(fetchFollow(new URL(res.headers.location, url).toString(), depth + 1));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout: ' + url));
    });
  });
}

function extractFolderIdFromUrl(url) {
  const m = String(url).match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

function isDriveFolderUrl(url) {
  return String(url).includes('drive.google.com/drive/folders');
}

function driveFileViewUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** Parse file IDs from raw folder page HTML (same patterns as prior puppeteer scrape). */
function extractFileIdsFromHtml(html, folderId) {
  const ids = [];
  const seen = new Set();

  const add = (id) => {
    if (!id || id === folderId || id.length < 20 || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const m of html.matchAll(/data-id="(1[A-Za-z0-9_-]{20,})"/g)) add(m[1]);
  for (const m of html.matchAll(/\/file\/d\/(1[A-Za-z0-9_-]{20,})/g)) add(m[1]);
  for (const m of html.matchAll(/googleusercontent\.com\/d\/(1[A-Za-z0-9_-]{20,})/g)) add(m[1]);
  for (const m of html.matchAll(/thumbnail\?id=(1[A-Za-z0-9_-]{20,})/g)) add(m[1]);
  for (const m of html.matchAll(/id=(1[A-Za-z0-9_-]{25,})&/g)) add(m[1]);
  for (const m of html.matchAll(/"(1[A-Za-z0-9_-]{32,44})"/g)) add(m[1]);

  return ids;
}

async function extractFileIdsFromHtmlFetch(folderId) {
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  console.log(`  → Fetching Drive folder HTML: ${folderId}`);
  const r = await fetchFollow(folderUrl);
  const html = r.body.toString('utf8');
  const ids = extractFileIdsFromHtml(html, folderId);
  console.log(`    HTML tier found ${ids.length} file id(s)`);
  return ids;
}

async function extractFileIdsFromDriveApi(folderId) {
  let google;
  try {
    google = require('googleapis').google;
  } catch {
    throw new Error(
      'googleapis is not installed. Run: npm install googleapis (in backend/lambda) to use --drive-api',
    );
  }

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    null;
  if (!credPath || !fs.existsSync(credPath)) {
    throw new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON to a service account JSON file',
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  console.log(`  → Drive API listing folder: ${folderId}`);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (res.data.files || []).filter((f) =>
    String(f.mimeType || '').startsWith('image/'),
  );
  const ids = files.map((f) => f.id).filter(Boolean);
  console.log(`    Drive API tier found ${ids.length} image file(s)`);
  return ids;
}

async function extractFileIdsFromBrowser(folderId) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    throw new Error(
      'puppeteer-core is not installed. Run: npm install puppeteer-core (in backend/lambda) to use --use-browser',
    );
  }

  const edgeExists = fs.existsSync(EDGE_PATH);
  const chromeExists = fs.existsSync(CHROME_PATH);
  const executablePath = edgeExists ? EDGE_PATH : chromeExists ? CHROME_PATH : null;
  if (!executablePath) {
    throw new Error('Neither Edge nor Chrome found for --use-browser fallback');
  }

  console.log(`  → Browser listing Drive folder: ${folderId}`);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    );
    await page.goto(`https://drive.google.com/drive/folders/${folderId}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await page
      .waitForSelector('[data-id], [data-target], .WYuW0e, .KL4PP', { timeout: 15000 })
      .catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));

    const html = await page.content();
    const ids = extractFileIdsFromHtml(html, folderId);
    console.log(`    Browser tier found ${ids.length} file id(s)`);
    return ids;
  } finally {
    if (page) await page.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

async function resolveFileIdsForFolder(folderId, options) {
  if (folderFileIdCache.has(folderId)) return folderFileIdCache.get(folderId);

  let ids = [];

  try {
    ids = await extractFileIdsFromHtmlFetch(folderId);
  } catch (e) {
    console.warn(`    HTML tier failed: ${e.message}`);
  }

  if (ids.length === 0 && options.useDriveApi) {
    try {
      ids = await extractFileIdsFromDriveApi(folderId);
    } catch (e) {
      console.warn(`    Drive API tier failed: ${e.message}`);
    }
  }

  if (ids.length === 0 && options.useBrowser) {
    try {
      ids = await extractFileIdsFromBrowser(folderId);
    } catch (e) {
      console.warn(`    Browser tier failed: ${e.message}`);
    }
  }

  folderFileIdCache.set(folderId, ids);
  return ids;
}

/**
 * Expand a Drive folder URL into direct file view URLs.
 * Non-folder http(s) URLs pass through as a single-element array.
 */
async function resolveFolderToDirectUrls(folderUrl, options = {}) {
  const url = String(folderUrl ?? '').trim();
  if (!url) return [];

  if (!isDriveFolderUrl(url)) {
    return /^https?:\/\//i.test(url) ? [url] : [];
  }

  const folderId = extractFolderIdFromUrl(url);
  if (!folderId) return [url];

  const fileIds = await resolveFileIdsForFolder(folderId, options);
  if (fileIds.length === 0) {
    console.warn(
      `    No files extracted from folder ${folderId}. Try --use-browser or --drive-api if folders are link-shared.`,
    );
    return [];
  }

  return fileIds.map(driveFileViewUrl);
}

function parseDriveOptions(argv) {
  return {
    useDriveApi: argv.includes('--drive-api'),
    useBrowser: argv.includes('--use-browser'),
  };
}

module.exports = {
  driveFileViewUrl,
  extractFolderIdFromUrl,
  extractFileIdsFromHtml,
  isDriveFolderUrl,
  parseDriveOptions,
  resolveFolderToDirectUrls,
};
