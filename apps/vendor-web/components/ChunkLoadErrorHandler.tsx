'use client';

import { useEffect } from 'react';

function isChunkLoadError(message: string, error?: unknown): boolean {
  const msg = String(message || '');
  return (
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('before initialization') || // TDZ / stale chunk (e.g. "Cannot access 'p' before initialization")
    (error != null && (error as { name?: string }).name === 'ChunkLoadError')
  );
}

function tryReloadOnce(): void {
  try {
    const key = 'vendor_chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    window.location.reload();
  }
}

/**
 * When a new deployment goes live, chunk filenames change (e.g. 3859.abc123.js → 3859.def456.js).
 * If the user still has old HTML cached, requests for old chunks return 404 (HTML), causing
 * "Unexpected token '<'" / ChunkLoadError. Reloading once fetches the new shell and fixes it.
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const err = event.error as { name?: string; message?: string } | undefined;
      const isRefErr = err?.name === 'ReferenceError' && (msg.includes('before initialization') || msg.includes('Cannot access'));
      if (isChunkLoadError(msg, event.error) || isRefErr) {
        tryReloadOnce();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? event.reason?.toString?.() ?? String(event.reason);
      if (isChunkLoadError(msg, event.reason)) {
        event.preventDefault();
        tryReloadOnce();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
