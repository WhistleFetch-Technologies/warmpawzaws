'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export interface InsurancePlanCard {
  id: string;
  companyName: string;
  name: string;
  highlights: string[];
  premiumFrom: number;
  premiumUnit: 'month' | 'year';
  disclaimer: string;
}

export function PlanGrid({ onOpen }: { onOpen: (planId: string) => void }) {
  const [plans, setPlans] = useState<InsurancePlanCard[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{ data?: { plans?: InsurancePlanCard[] } }>('/customer/insurance/plans')
      .then((res) => setPlans(res.data?.plans || []))
      .catch(() => setError('Plans are not available right now.'));
  }, []);

  if (error) return <p className="px-4 py-6 text-sm text-gray-600">{error}</p>;
  if (plans.length === 0) return <p className="px-4 py-6 text-sm text-gray-600">No published plans yet.</p>;

  return (
    <div className="space-y-3 px-4 py-4">
      {plans.map((plan) => (
        <article key={plan.id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{plan.companyName}</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{plan.name}</h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-gray-700">
            {(plan.highlights || []).slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-gray-900">
            Premium starts at ₹{plan.premiumFrom} / {plan.premiumUnit}
          </p>
          <p className="mt-1 text-xs text-gray-500">{plan.disclaimer}</p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[#FF8C42] py-3 text-sm font-bold text-white"
            onClick={() => onOpen(plan.id)}
          >
            Continue to consultation
          </button>
        </article>
      ))}
    </div>
  );
}
