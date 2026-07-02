'use client';

import { Lock } from 'lucide-react';

const ITEMS = [
  'Priority rules',
  'Stack rules',
  'Funding & co-pay',
  'Settlement',
  'Campaigns',
  'Approval workflow',
  'Feature flags',
  'Analytics',
];

export function ComingSoonSection({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-slate-400" />
        <h4 className="text-sm font-semibold text-slate-700">Coming soon</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => (
          <span
            key={item}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
