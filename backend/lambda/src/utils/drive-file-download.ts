/**
 * Download a Google Drive file as real image bytes.
 * Uses export=download + confirm-token HTML, then lh3 fallback.
 * Never returns a Drive view URL — caller must treat { ok: false } as a hard fail.
 */

import https from 'https';
import { validateImageBuffer } from '../services/image/image-validator';

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12000;
const FILE_ID_RE = /^1[A-Za-z0-9_-]{20,}$/;

export type DriveBinaryFetchResult = {
  status: number;
  contentType: string;
  body: Buffer;
  setCookie: string[];
};

export type DriveBinaryFetch = (
  url: string,
  cookies?: string,
) => Promise<DriveBinaryFetchResult>;

export type DriveFileDownloadResult =
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; message: string };

const FAIL_MSG =
  'Could not download this Drive file as an image. Share it as Anyone with the link (Viewer).';

export function isAllowedDriveDownloadHost(hostname: string): boolean {
  const h = String(hostname ?? '').toLowerCase();
  return (
    h === 'drive.google.com' ||
    h === 'docs.google.com' ||
    h === 'googleusercontent.com' ||
    h.endsWith('.googleusercontent.com')
  );
}

export function extractDriveFileId(urlOrId: string): string | null {
  const raw = String(urlOrId ?? '').trim();
  if (!raw) return null;
  if (FILE_ID_RE.test(raw)) return raw;

  try {
    const u = new URL(raw);
    const fromQuery = u.searchParams.get('id');
    if (fromQuery && FILE_ID_RE.test(fromQuery)) return fromQuery;
    const fileMatch = u.pathname.match(/\/file\/d\/(1[A-Za-z0-9_-]{20,})/);
    if (fileMatch) return fileMatch[1];
  } catch {
    const loose = raw.match(/\/file\/d\/(1[A-Za-z0-9_-]{20,})/);
    if (loose) return loose[1];
    const idLoose = raw.match(/[?&]id=(1[A-Za-z0-9_-]{20,})/);
    if (idLoose) return idLoose[1];
  }
  return null;
}

export function driveDownloadUrl(fileId: string, confirm?: string): string {
  const id = encodeURIComponent(fileId);
  if (confirm) {
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=${encodeURIComponent(confirm)}`;
  }
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function lh3DriveUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
}

export function parseDriveConfirmToken(html: string): string | null {
  const body = String(html ?? '');
  const named = body.match(/name=["']confirm["']\s+value=["']([^"']+)["']/i);
  if (named?.[1]) return named[1];
  const confirmEq = body.match(/[?&]confirm=([0-9A-Za-z_-]+)/);
  if (confirmEq?.[1] && confirmEq[1] !== 't') return confirmEq[1];
  if (/confirm=t\b/.test(body)) return 't';
  return null;
}

function parseCookieHeader(setCookie: string[]): string {
  const pairs: string[] = [];
  for (const raw of setCookie) {
    const first = String(raw).split(';')[0]?.trim();
    if (first && first.includes('=')) pairs.push(first);
  }
  return pairs.join('; ');
}

function looksLikeHtml(contentType: string, body: Buffer): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes('text/html')) return true;
  const head = body.subarray(0, 200).toString('utf8').trim().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html');
}

export async function defaultDriveBinaryFetch(
  url: string,
  cookies?: string,
  redirectsLeft = MAX_REDIRECTS,
): Promise<DriveBinaryFetchResult> {
  if (redirectsLeft < 0) {
    throw new Error('Too many redirects');
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https Drive downloads are allowed');
  }
  if (!isAllowedDriveDownloadHost(parsed.hostname)) {
    throw new Error('Host not allowed');
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
          ...(cookies ? { Cookie: cookies } : {}),
        },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        const setCookie = res.headers['set-cookie']
          ? Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']]
          : [];
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          const merged = [cookies, parseCookieHeader(setCookie)].filter(Boolean).join('; ');
          resolve(defaultDriveBinaryFetch(next, merged || undefined, redirectsLeft - 1));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_DOWNLOAD_BYTES) {
            req.destroy();
            reject(new Error('Image exceeds size limit'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers['content-type'] || ''),
            body: Buffer.concat(chunks),
            setCookie,
          }),
        );
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function bufferToImageResult(body: Buffer): DriveFileDownloadResult | null {
  if (!body.length) return null;
  const validation = validateImageBuffer(body);
  if (!validation.ok) return null;
  return { ok: true, buffer: body, mime: validation.detectedMime };
}

async function tryUrl(
  url: string,
  fetchFn: DriveBinaryFetch,
  cookies?: string,
): Promise<{ image: DriveFileDownloadResult | null; html?: string; cookies?: string }> {
  const res = await fetchFn(url, cookies);
  if (res.status < 200 || res.status >= 400) {
    return { image: null };
  }
  const image = bufferToImageResult(res.body);
  if (image) return { image };
  if (looksLikeHtml(res.contentType, res.body)) {
    const merged = [cookies, parseCookieHeader(res.setCookie)].filter(Boolean).join('; ');
    return { image: null, html: res.body.toString('utf8'), cookies: merged || undefined };
  }
  return { image: null };
}

export async function downloadDriveFileImage(
  fileId: string,
  fetchFn: DriveBinaryFetch = defaultDriveBinaryFetch,
): Promise<DriveFileDownloadResult> {
  const id = extractDriveFileId(fileId) ?? String(fileId ?? '').trim();
  if (!FILE_ID_RE.test(id)) {
    return { ok: false, message: FAIL_MSG };
  }

  try {
    const first = await tryUrl(driveDownloadUrl(id), fetchFn);
    if (first.image) return first.image;

    if (first.html) {
      const token = parseDriveConfirmToken(first.html);
      if (token) {
        const confirmed = await tryUrl(driveDownloadUrl(id, token), fetchFn, first.cookies);
        if (confirmed.image) return confirmed.image;
      }
    }

    const lh3 = await tryUrl(lh3DriveUrl(id), fetchFn, first.cookies);
    if (lh3.image) return lh3.image;
  } catch {
    return { ok: false, message: FAIL_MSG };
  }

  return { ok: false, message: FAIL_MSG };
}
