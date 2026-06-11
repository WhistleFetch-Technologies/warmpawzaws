'use client';

import { useEffect } from 'react';

function isChunkLoadError(message: string): boolean {
  const msg = (message || '').toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading css chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('before initialization')
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error.message);

  useEffect(() => {
    if (!chunkError) return;
    try {
      const key = 'vendor_chunk_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [chunkError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {chunkError ? 'Update available' : '500'}
        </h1>
        <h2 className="text-xl text-gray-700 mb-4">
          {chunkError ? 'Refreshing the app…' : 'Something went wrong!'}
        </h2>
        <p className="text-gray-600 mb-6">
          {chunkError
            ? 'A new version was deployed. Reloading should fix this.'
            : error.message}
        </p>
        <button
          onClick={() => (chunkError ? window.location.reload() : reset())}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          {chunkError ? 'Reload now' : 'Try again'}
        </button>
      </div>
    </div>
  );
}

