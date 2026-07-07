/**
 * Ingest external product image URLs into our own S3 storage.
 *
 * Why this exists: external hosts (e.g. Google Drive share links) are not
 * reliable for hotlinking on a live storefront — they enforce per-file
 * view/bandwidth quotas and bot-traffic detection, so a link that works once
 * in a manual test can start serving an HTML error page instead of image
 * bytes once real shop/vendor traffic hits it repeatedly. Any http(s) image
 * URL that isn't already one of our managed S3 objects is downloaded once,
 * compressed, and re-hosted here; only the resulting permanent S3 URL string
 * is ever persisted on the product/sku row (never raw image bytes in the DB).
 * Display continues to go through the existing presign layer
 * (see s3-media-presign.ts), same as a normal vendor photo upload.
 */
import http from 'http';
import https from 'https';
import { Jimp, JimpMime } from 'jimp';
import { isManagedProductS3Image, uploadProductImageBufferToS3 } from './product-s3-image';

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // safety cap on fetched source images
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20000;

/** Matches the client-side vendor upload compression target (compress-product-image.ts). */
const TARGET_MAX_BYTES = 500 * 1024;
const TARGET_MAX_EDGE_PX = 1600;
const JPEG_START_QUALITY = 85;
const JPEG_MIN_QUALITY = 40;
const JPEG_QUALITY_STEP = 10;

type FetchResult = { contentType: string; body: Buffer };

function fetchBinary(url: string, redirectsLeft = MAX_REDIRECTS): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) {
      reject(new Error(`Too many redirects fetching ${url}`));
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid image URL: ${url}`));
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error(`Unsupported protocol for image URL: ${url}`));
      return;
    }
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WarmpawzImageIngest/1.0)',
          Accept: 'image/*,*/*;q=0.8',
        },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(fetchBinary(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          reject(new Error(`Fetch failed (status ${res.statusCode}) for ${url}`));
          return;
        }
        const contentType = String(res.headers['content-type'] || '');
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_DOWNLOAD_BYTES) {
            req.destroy();
            reject(new Error(`Image exceeds ${MAX_DOWNLOAD_BYTES}-byte limit: ${url}`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ contentType, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/** Resize (only if larger than target) and re-encode as JPEG under the byte budget. */
async function compressImageBuffer(
  input: Buffer,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const image = await Jimp.fromBuffer(input);
  const longestEdge = Math.max(image.bitmap.width, image.bitmap.height);
  if (longestEdge > TARGET_MAX_EDGE_PX) {
    image.scaleToFit({ w: TARGET_MAX_EDGE_PX, h: TARGET_MAX_EDGE_PX });
  }

  let quality = JPEG_START_QUALITY;
  let buffer = await image.getBuffer(JimpMime.jpeg, { quality });
  while (buffer.length > TARGET_MAX_BYTES && quality > JPEG_MIN_QUALITY) {
    quality -= JPEG_QUALITY_STEP;
    buffer = await image.getBuffer(JimpMime.jpeg, { quality });
  }
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}

/**
 * Given any http(s) product image URL, ensure it ends up hosted on our S3
 * bucket. Returns the new permanent S3 URL on success.
 *
 * On failure (source unreachable, not an image, over the size cap, etc.)
 * falls back to returning the original URL unchanged rather than dropping
 * the image — a transient fetch failure should not make a product lose its
 * photo outright. The next successful save will retry ingestion, since a
 * still-external URL is not treated as "already managed".
 *
 * No-op (returns the input unchanged) when the URL already points at one of
 * our managed S3 objects, so repeated saves don't re-download/re-compress
 * the same file.
 */
export async function ingestExternalProductImageUrl(
  vendorId: string,
  rawUrl: string,
): Promise<string> {
  const url = String(rawUrl ?? '').trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (isManagedProductS3Image(url)) return url;

  try {
    const { body } = await fetchBinary(url);
    if (!body.length) {
      console.warn('[product-image-ingest] Empty response body, keeping original URL:', url);
      return url;
    }
    const { buffer, contentType, ext } = await compressImageBuffer(body);
    return await uploadProductImageBufferToS3(vendorId, buffer, contentType, ext);
  } catch (e) {
    console.warn(
      '[product-image-ingest] Failed to ingest external image, keeping original URL:',
      url,
      (e as Error)?.message || e,
    );
    return url;
  }
}

/**
 * Run every http(s) URL in a product's image list through ingestion. Returns
 * a new array — the input list is not mutated. Non-http(s) entries (blob:
 * URLs, empty strings) are dropped; data: URLs should be uploaded by the
 * caller's own base64 upload path before reaching here.
 */
export async function ingestExternalProductImageUrls(
  vendorId: string,
  urls: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = String(url ?? '').trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) continue;
    out.push(await ingestExternalProductImageUrl(vendorId, trimmed));
  }
  return out;
}
