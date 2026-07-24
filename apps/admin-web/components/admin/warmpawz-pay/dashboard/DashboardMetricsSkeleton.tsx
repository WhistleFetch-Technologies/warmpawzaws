'use client';

export function DashboardMetricsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse"
      aria-hidden="true"
    >
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-200 bg-white p-6 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-5 w-5 rounded bg-gray-200" />
          </div>
          <div className="h-8 w-20 rounded bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
