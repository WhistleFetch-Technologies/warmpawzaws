'use client';

import { useEffect } from 'react';
import {
  clearChunkReloadCounter,
  isChunkLoadMessage,
  tryRecoverFromChunkError,
} from '@/lib/vendor-chunk-recovery';

/**
 * When a new deployment goes live, chunk filenames change. Long-lived Android WebView
 * sessions keep an old webpack manifest and fail with "Loading chunk N failed".
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const bootTimer = window.setTimeout(() => clearChunkReloadCounter(), 4000);

    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const err = event.error as { name?: string; message?: string } | undefined;
      const isRefErr =
        err?.name === 'ReferenceError' &&
        (msg.includes('before initialization') || msg.includes('Cannot access'));
      if (isChunkLoadMessage(msg, event.error) || isRefErr) {
        tryRecoverFromChunkError();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? event.reason?.toString?.() ?? String(event.reason);
      if (isChunkLoadMessage(msg, event.reason)) {
        event.preventDefault();
        tryRecoverFromChunkError();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.clearTimeout(bootTimer);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
