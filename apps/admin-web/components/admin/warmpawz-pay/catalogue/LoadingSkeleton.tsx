'use client';

export function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-10 rounded-lg bg-gray-200" />
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
