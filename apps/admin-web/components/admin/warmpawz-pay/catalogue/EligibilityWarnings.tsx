'use client';

import { AlertTriangle } from 'lucide-react';
import type { EligibilityDTO } from '@/lib/warmpawz-pay-catalogue-admin';

export interface EligibilityWarningsProps {
  readonly eligibility: EligibilityDTO;
  readonly warnings?: readonly string[];
}

export function EligibilityWarnings({ eligibility, warnings = [] }: EligibilityWarningsProps) {
  const derivedWarnings = [...warnings];
  const status = eligibility.vendorStatus.toLowerCase();

  if (status !== 'active' && status !== 'approved') {
    derivedWarnings.push(`Vendor status is "${eligibility.vendorStatus}".`);
  }
  if (!eligibility.bankVerified) {
    derivedWarnings.push('Bank account is not verified.');
  }
  if (!eligibility.customerVisible) {
    derivedWarnings.push(
      'This vendor is not customer-visible in Pay Bill discovery (must be published with approved/active profile and bank verified).',
    );
  }

  const uniqueWarnings = Array.from(new Set(derivedWarnings));
  if (uniqueWarnings.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        Vendor meets eligibility requirements for customer visibility.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        Eligibility warnings
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
        {uniqueWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
