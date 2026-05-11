'use client';

export function SubscriptionProgressPreview({
  totalSessions,
  completed,
  label,
}: {
  totalSessions: number;
  completed: number;
  label?: string;
}) {
  const pct = totalSessions > 0 ? Math.min(100, Math.round((completed / totalSessions) * 100)) : 0;
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
      <div className="flex justify-between text-xs font-medium text-slate-600 mb-2">
        <span>{label || 'Progress preview'}</span>
        <span>
          {completed} / {totalSessions} sessions
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-white overflow-hidden ring-1 ring-orange-100">
        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
