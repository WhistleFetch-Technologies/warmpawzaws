'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Heart, PawPrint, Shield } from 'lucide-react';
import { CachedImage } from '@/components/shared/CachedImage';
import { apiClient } from '@/lib/api-client';
import { PolicyDetailPanel, type PolicyDetailData } from './PolicyDetailPanel';
import { CustomerPolicyCards } from './CustomerPolicyCards';

export interface InsurancePlanCard {
  id: string;
  companyName: string;
  logoUrl?: string | null;
  name: string;
  highlights: string[];
  premiumFrom: number;
  premiumUnit: 'month' | 'year';
  disclaimer: string;
}

const CARD_TONES = [
  { wash: 'bg-sky-50', icon: 'bg-sky-100 text-sky-600' },
  { wash: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700' },
  { wash: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600' },
  { wash: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600' },
  { wash: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600' },
  { wash: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600' },
] as const;

const COVER_ICONS = [Shield, FileText, PawPrint, Heart] as const;
const COVER_COLORS = ['text-emerald-600', 'text-sky-600', 'text-orange-500', 'text-rose-500'] as const;

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

export function PlanGrid({
  onOpen,
  onBack,
}: {
  onOpen: () => void;
  onBack?: () => void;
}) {
  const [plans, setPlans] = useState<InsurancePlanCard[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PolicyDetailData | null>(null);
  const [detailError, setDetailError] = useState('');
  const [tab, setTab] = useState<'plans' | 'active'>('plans');

  useEffect(() => {
    apiClient
      .get<{ data?: { plans?: InsurancePlanCard[] } }>('/customer/insurance/plans')
      .then((res) => setPlans(res.data?.plans || []))
      .catch(() => setError('Plans are not available right now.'))
      .finally(() => setLoading(false));
  }, []);

  const openDetails = async (planId: string) => {
    setDetailError('');
    try {
      const res = await apiClient.get<{
        data?: {
          plan?: InsurancePlanCard;
          coverOptions?: PolicyDetailData['coverOptions'];
          sumInsuredOptions?: string[];
          copayOptions?: string[];
        };
      }>(`/customer/insurance/plans/${planId}`);
      const plan = res.data?.plan;
      if (!plan) {
        setDetailError('This policy is not available.');
        return;
      }
      setDetail({
        plan,
        coverOptions: res.data?.coverOptions || [],
        sumInsuredOptions: (res.data?.sumInsuredOptions || []).map(String),
        copayOptions: (res.data?.copayOptions || []).map(String),
      });
    } catch {
      setDetailError('This policy is not available.');
    }
  };

  if (detail) {
    return (
      <PolicyDetailPanel
        detail={detail}
        onBack={() => setDetail(null)}
      />
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FFF8F3]">
      <header className="bg-gradient-to-br from-[#FF8C42] to-[#FF7A2F] px-4 pb-5 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Pet Insurance</h1>
        <p className="mt-0.5 text-sm text-white/90">
          {tab === 'plans' ? 'Compare top plans for your pet' : 'Policies that have been issued for you'}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-white/20 p-1">
          <button
            type="button"
            className={`h-9 rounded-full text-sm font-semibold ${tab === 'plans' ? 'bg-white text-[#FF8C42]' : 'text-white'}`}
            onClick={() => setTab('plans')}
          >
            Plans
          </button>
          <button
            type="button"
            className={`min-h-9 rounded-full px-2 text-xs font-semibold leading-tight sm:text-sm ${tab === 'active' ? 'bg-white text-[#FF8C42]' : 'text-white'}`}
            onClick={() => setTab('active')}
          >
            Your active policy
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        {tab === 'active' ? <CustomerPolicyCards scope="active" /> : null}
        {tab === 'plans' ? (
        <>
        {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading plans…</p> : null}
        {error || detailError ? <p className="py-8 text-center text-sm text-gray-600">{error || detailError}</p> : null}
        {!loading && !error && plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No published plans yet.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {plans.map((plan, index) => {
            const tone = CARD_TONES[index % CARD_TONES.length];
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border border-orange-100 p-3 text-left shadow-sm ${tone.wash}`}
              >
                <span className="mb-2 flex items-start justify-between gap-2">
                  <span className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ${tone.icon}`}>
                    {plan.logoUrl ? (
                      <CachedImage src={plan.logoUrl} alt="" fill className="object-cover" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`View ${plan.companyName} ${plan.name} details`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openDetails(plan.id);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </span>
                <span className="text-[13px] font-bold leading-tight text-[#1E2A4A]">{plan.companyName}</span>
                <span className="mt-0.5 text-[11px] text-gray-500">{plan.name}</span>
                <ul className="mt-2 space-y-1">
                  {(plan.highlights || []).slice(0, 3).map((item, highlightIndex) => {
                    const Icon = COVER_ICONS[highlightIndex % COVER_ICONS.length];
                    return (
                      <li key={item} className="flex items-start gap-1.5 text-[10px] leading-snug text-gray-600">
                        <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${COVER_COLORS[highlightIndex % COVER_COLORS.length]}`} />
                        <span>{item}</span>
                      </li>
                    );
                  })}
                </ul>
                <span className="mt-auto pt-3 text-[10px] text-gray-500">Premium starts at</span>
                <span className="text-sm font-extrabold text-[#1E2A4A]">
                  ₹{formatInr(plan.premiumFrom)}
                  <span className="text-[11px] font-semibold">/{plan.premiumUnit}</span>
                </span>
              </div>
            );
          })}
        </div>
        </>
        ) : null}
      </div>

      {tab === 'plans' ? (
      <div className="sticky bottom-[var(--customer-tabbed-nav-offset,0px)] bg-[#FFF8F3] px-4 pb-3 pt-2">
        <button
          type="button"
          disabled={loading || plans.length === 0}
          onClick={onOpen}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C42] text-sm font-bold text-white disabled:bg-slate-300"
        >
          Continue to Consultation
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          Coverage and pricing are confirmed by the insurer/vendor.
        </p>
      </div>
      ) : null}
    </div>
  );
}
