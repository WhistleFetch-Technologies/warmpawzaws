/** Session key — stores reload attempt count (not a boolean). */
export const VENDOR_CHUNK_RELOAD_KEY = 'vendor_chunk_reload';

const MAX_CHUNK_RELOAD_ATTEMPTS = 5;

export function isChunkLoadMessage(message: string, error?: unknown): boolean {
  const msg = String(message || '').toLowerCase();
  const name = error != null ? String((error as { name?: string }).name || '').toLowerCase() : '';
  return (
    name === 'chunkloaderror' ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading css chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('before initialization') ||
    msg.includes('unexpected token')
  );
}

export function getChunkReloadAttemptCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(VENDOR_CHUNK_RELOAD_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 0;
  }
}

export function clearChunkReloadCounter(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(VENDOR_CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

/** Cache-busted hard reload — WebView often ignores a plain reload(). */
export function tryRecoverFromChunkError(force = false): void {
  if (typeof window === 'undefined') return;
  try {
    const count = getChunkReloadAttemptCount();
    if (!force && count >= MAX_CHUNK_RELOAD_ATTEMPTS) return;
    sessionStorage.setItem(VENDOR_CHUNK_RELOAD_KEY, String(count + 1));
    const url = new URL(window.location.href);
    url.searchParams.delete('_cv');
    url.searchParams.delete('_v');
    url.searchParams.set('_cv', String(Date.now()));
    // Ensure .html shell for static-export routes (not client-router path)
    if (!url.pathname.endsWith('.html')) {
      const base = url.pathname.replace(/\/$/, '') || '';
      if (base === '' || base === '/') {
        url.pathname = '/index.html';
      } else {
        url.pathname = `${base}.html`;
      }
    }
    window.location.replace(url.pathname + url.search + url.hash);
  } catch {
    window.location.reload();
  }
}
