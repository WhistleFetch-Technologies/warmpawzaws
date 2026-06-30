'use client';

import { Skeleton } from '@/components/ui/LoadingStates';

export function MealPlanOrdersListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading meal orders">
      <div className="-mx-4 flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60"
        >
          <div className="flex gap-3">
            <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="ml-auto h-5 w-14" />
              <Skeleton className="ml-auto h-3 w-10" />
            </div>
          </div>
          <Skeleton className="mt-3 h-14 w-full rounded-xl" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
