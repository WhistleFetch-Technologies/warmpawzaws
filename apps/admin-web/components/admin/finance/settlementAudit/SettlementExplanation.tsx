'use client';

import type { BookingEarningsLine } from '@/lib/finance/settlement-audit-types';
import { buildSettlementExplanationSteps } from '@/lib/finance/settlementExplanation';

export function SettlementExplanation({ line }: { line: BookingEarningsLine }) {
  const steps = buildSettlementExplanationSteps(line);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">Settlement explanation</h4>
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={`${step.label}-${idx}`} className="flex flex-col gap-0.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-gray-600">{step.label}</span>
              {step.amount ? <span className="font-medium tabular-nums text-gray-900">{step.amount}</span> : null}
            </div>
            {step.detail ? <span className="text-xs text-gray-500">{step.detail}</span> : null}
            {idx < steps.length - 1 ? <div className="text-center text-xs text-gray-400">↓</div> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
