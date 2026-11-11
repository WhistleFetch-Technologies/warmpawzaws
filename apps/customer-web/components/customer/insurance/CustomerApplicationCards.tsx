'use client';

import { useEffect, useState } from 'react';
import { Headphones, PawPrint } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerId } from '@/lib/insurance-customer';

export type CustomerApplication = {
  applicationId: string;
  reference: string;
  status: string;
  statusLabel: string;
  progressStep: 1 | 2 | 3 | 4;
  companyName?: string | null;
  planName?: string | null;
  petName?: string | null;
  petSpecies?: string | null;
  petBreed?: string | null;
  coverageSelection?: {
    mainSection: string | null;
    sumInsured: number | null;
    copayPercent: number | null;
  };
  premiumNote?: string;
  paymentLinkAvailable?: boolean;
};

const PROGRESS = [
  'Application received',
  'Advisor reviews',
  'Official quote shared',
  'You decide to proceed',
] as const;

function formatInr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN')}`;
}

function mainSectionLabel(key: string | null | undefined): string {
  if (key === 'comprehensive') return 'Comprehensive Cover';
  if (key === 'make_your_own') return 'Make Your Own Plan';
  if (key === 'third_party') return 'Third-Party Liability';
  return '';
}

export function CustomerApplicationCards({
  focusApplicationId,
  onTalkToExpert,
}: {
  focusApplicationId?: string;
  onTalkToExpert?: () => void;
}) {
  const [rows, setRows] = useState<CustomerApplication[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(focusApplicationId || null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const customerId = await resolveCustomerId();
        if (!customerId) {
          if (!cancelled) {
            setMessage('Sign in again to see your applications.');
            setRows([]);
          }
          return;
        }
        const res = await apiClient.get<{ data?: { applications?: CustomerApplication[] } }>(
          `/customer/insurance/applications?customerId=${customerId}`,
        );
        if (cancelled) return;
        const list = res.data?.applications || [];
        setRows(list);
        setMessage('');
        if (focusApplicationId && list.some((a) => a.applicationId === focusApplicationId)) {
          setExpandedId(focusApplicationId);
        }
      } catch {
        if (!cancelled) setMessage('Applications could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [focusApplicationId]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#6B7280]">Loading applications…</p>;
  }
  if (message) {
    return <p className="py-8 text-center text-sm text-[#6B7280]">{message}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#F0E6DB] bg-white p-5 text-center space-y-2">
        <p className="text-sm font-semibold text-[#1F2A37]">No applications yet</p>
        <p className="text-xs text-[#6B7280] leading-relaxed">
          When you submit a free quote request, it will appear here so you can track progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#D5DEE8] bg-[#EEF2F6] px-3.5 py-3 text-[13px] leading-relaxed text-[#1F2A37]">
        Official premium is confirmed by HDFC ERGO. Payment is only requested after you accept an insurer
        quotation — no payment link on this screen.
      </div>

      {rows.map((row) => {
        const focused = focusApplicationId === row.applicationId;
        const open = expandedId === row.applicationId;
        const cover = mainSectionLabel(row.coverageSelection?.mainSection);
        const si = formatInr(row.coverageSelection?.sumInsured ?? null);
        const step = Math.min(4, Math.max(1, row.progressStep || 1)) as 1 | 2 | 3 | 4;

        return (
          <article
            key={row.applicationId}
            className={`rounded-2xl border bg-white p-4 shadow-[0_10px_30px_rgba(31,42,55,0.05)] ${
              focused ? 'border-[#FF8C42]' : 'border-[#F0E6DB]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex rounded-full bg-[#FFF4EC] px-2.5 py-1 text-[11px] font-bold text-[#FF8C42]">
                {row.status === 'enquiry_submitted' ? 'Application received' : row.statusLabel}
              </span>
              <span className="text-xs font-semibold text-[#6B7280]">{row.reference}</span>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#FFF4EC] text-[#FF8C42] flex items-center justify-center shrink-0">
                <PawPrint className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#1F2A37]">
                  {row.petName || 'Pet'}
                  {row.petBreed ? ` · ${row.petBreed}` : ''}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {row.companyName || 'HDFC ERGO'} · {row.planName || 'Paws N Claws'}
                </p>
                {cover || si ? (
                  <p className="text-xs text-[#9A6B3F] mt-1 font-medium">
                    {[cover, si ? `SI ${si}` : '', row.coverageSelection?.copayPercent != null ? `Co-pay ${row.coverageSelection.copayPercent}%` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-[#1F2A37]">Progress</p>
              {PROGRESS.map((label, idx) => {
                const n = (idx + 1) as 1 | 2 | 3 | 4;
                const done = step > n;
                const current = step === n;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        done || current ? 'bg-[#FF8C42]' : 'bg-[#E8DED3]'
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        current ? 'font-semibold text-[#1F2A37]' : 'text-[#6B7280]'
                      }`}
                    >
                      {n}. {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {open ? (
              <p className="mt-3 text-xs text-[#6B7280] leading-relaxed border-t border-[#F0E6DB] pt-3">
                {row.premiumNote ||
                  'An authorised advisor will review your application and obtain the official HDFC ERGO quotation.'}
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              <button
                type="button"
                className="w-full h-11 rounded-2xl bg-[#FF8C42] text-white text-sm font-bold"
                onClick={() => setExpandedId(open ? null : row.applicationId)}
              >
                {open ? 'Hide details' : 'View details'}
              </button>
              {onTalkToExpert ? (
                <button
                  type="button"
                  className="w-full h-11 rounded-2xl border border-[#E8DED3] bg-white text-[#1F2A37] text-sm font-semibold inline-flex items-center justify-center gap-2"
                  onClick={onTalkToExpert}
                >
                  <Headphones className="w-4 h-4" />
                  Talk to advisor
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
