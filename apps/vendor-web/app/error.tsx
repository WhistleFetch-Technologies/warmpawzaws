'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">500</h1>
        <h2 className="text-xl text-gray-700 mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

