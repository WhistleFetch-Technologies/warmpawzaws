'use client';

import { ArrowLeft, Shield } from 'lucide-react';
import type { InsurancePlanCard } from './PlanGrid';

interface CoverOption {
  key?: string;
  label?: string;
  description?: string;
}

export interface PolicyDetailData {
  plan: InsurancePlanCard;
  coverOptions: CoverOption[];
  sumInsuredOptions: string[];
  copayOptions: string[];
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'label' in value) return String((value as CoverOption).label || '');
  return '';
}

export function PolicyDetailPanel({
  detail,
  onBack,
}: {
  detail: PolicyDetailData;
  onBack: () => void;
}) {
  const { plan } = detail;
  const covers = (detail.coverOptions || []).map(asText).filter(Boolean);
  const highlights = (plan.highlights || []).filter(Boolean);
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FFF8F3]">
      <header className="bg-gradient-to-br from-[#FF8C42] to-[#FF7A2F] px-4 pb-5 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label="Back to plans"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{plan.companyName}</p>
        <h1 className="text-xl font-bold">{plan.name}</h1>
      </header>
      <div className="flex-1 space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-orange-100 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#1E2A4A]">{plan.companyName}</p>
              <p className="text-xs text-gray-500">Read only. The insurer confirms the final cover.</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-gray-500">Premium starts at</p>
          <p className="text-lg font-extrabold text-[#1E2A4A]">
            ₹{formatInr(plan.premiumFrom)}
            <span className="text-sm font-semibold">/{plan.premiumUnit}</span>
          </p>
        </section>
        {highlights.length > 0 ? (
          <section className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Highlights</h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {covers.length > 0 ? (
          <section className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Cover</h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {covers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {detail.sumInsuredOptions.length > 0 ? (
          <section className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Sum insured</h2>
            <p className="mt-2 text-sm text-gray-600">{detail.sumInsuredOptions.join(', ')}</p>
          </section>
        ) : null}
        {detail.copayOptions.length > 0 ? (
          <section className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Copay</h2>
            <p className="mt-2 text-sm text-gray-600">{detail.copayOptions.join(', ')}</p>
          </section>
        ) : null}
        <p className="text-center text-[11px] text-gray-500">{plan.disclaimer}</p>
      </div>
    </div>
  );
}
