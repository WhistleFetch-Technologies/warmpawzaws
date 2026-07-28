'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { MerchantReadiness } from '@/lib/warmpawz-appointments-merchant-types';

export interface ReadinessDetailPanelProps {
  readonly readiness: MerchantReadiness;
}

export function ReadinessDetailPanel({ readiness }: ReadinessDetailPanelProps) {
  return (
    <div
      className="rounded-lg border border-blue-100 bg-blue-50/60 p-4"
      aria-label="Vendor readiness checks"
    >
      <p className="mb-3 text-sm font-medium text-gray-900">Readiness checks</p>
      <ul className="space-y-2">
        {readiness.checks.map((check) => {
          const Icon = check.passed ? CheckCircle2 : AlertCircle;
          const tone = check.passed
            ? 'text-green-600'
            : check.severity === 'blocker'
              ? 'text-red-600'
              : 'text-amber-600';

          return (
            <li key={check.key} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
              <div>
                <span className="font-medium text-gray-900">{check.label}</span>
                {check.detail ? (
                  <p className="text-xs text-gray-600">{check.detail}</p>
                ) : null}
                {!check.passed && check.severity === 'warning' ? (
                  <p className="text-xs text-amber-700">Warning only</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
