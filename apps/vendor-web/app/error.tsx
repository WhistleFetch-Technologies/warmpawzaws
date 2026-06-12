'use client';

import { useEffect } from 'react';
import {
  clearChunkReloadCounter,
  getChunkReloadAttemptCount,
  isChunkLoadMessage,
  tryRecoverFromChunkError,
} from '@/lib/vendor-chunk-recovery';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadMessage(error.message, error);

  useEffect(() => {
    if (!chunkError) return;
    tryRecoverFromChunkError();
  }, [chunkError]);

  const handleAction = () => {
    if (chunkError) {
      clearChunkReloadCounter();
      tryRecoverFromChunkError(true);
      return;
    }
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {chunkError ? 'Update available' : '500'}
        </h1>
        <h2 className="text-xl text-gray-700 mb-4">
          {chunkError ? 'App needs a quick refresh' : 'Something went wrong!'}
        </h2>
        <p className="text-gray-600 mb-6">
          {chunkError
            ? getChunkReloadAttemptCount() >= 5
              ? 'Tap below to reload with the latest version.'
              : 'Reloading automatically…'
            : error.message}
        </p>
        <button
          onClick={handleAction}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          {chunkError ? 'Reload now' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
