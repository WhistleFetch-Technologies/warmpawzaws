'use client';

export function DashboardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse space-y-3"
        >
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-5 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="flex gap-2">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
