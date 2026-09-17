'use client';

import { JOURNEY_TEMPLATE_LABELS } from '@/lib/promo-engine/journey-templates';

export function AudienceStep() {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-800">Audience & journey rules — Bindu Phase 3</p>
      <p>
        Shell only. Next pass adds service + package pickers, AND/OR rows, plain-language preview,
        and journey templates:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {Object.values(JOURNEY_TEMPLATE_LABELS).map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p>Compiler already lives in <code>lib/promo-engine/journey-templates.ts</code>.</p>
    </div>
  );
}
