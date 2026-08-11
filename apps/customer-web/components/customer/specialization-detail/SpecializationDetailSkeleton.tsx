'use client';

export function SpecializationDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 px-1">
      <div className="h-56 rounded-[24px] bg-slate-200" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-orange-100" />
        ))}
      </div>
      <div className="h-48 rounded-[24px] bg-orange-50/80" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-[20px] bg-slate-100" />
        ))}
      </div>
      <div className="h-36 rounded-[20px] bg-blue-50/80" />
      <div className="h-44 rounded-[24px] bg-slate-100" />
      <div className="h-28 rounded-[20px] bg-amber-50/80" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-[88px] rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
