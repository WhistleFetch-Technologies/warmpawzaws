'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface TeleService {
  vendorServiceId: string;
  name: string;
  price: number;
  duration: number;
}

interface TeleSlot {
  date: string;
  time: string;
  label: string;
}

export interface InsuranceVendorOption {
  vendorId: string;
  name: string;
  rating: number | null;
  nextTeleSlot: string | null;
  slots: TeleSlot[];
  teleService: TeleService | null;
}

export interface InsuranceBookingChoice {
  planId: string;
  vendor: InsuranceVendorOption;
  slot: TeleSlot;
}

interface PlanChoice {
  id: string;
  companyName: string;
  name: string;
}

function formatNextAvailability(label: string | null): string {
  if (!label) return 'Next: check availability';
  const match = /^(.*)\s(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!match) return `Next: ${label}`;
  let hour = Number(match[2]);
  const suffix = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  const clock = match[3] === '00' ? String(hour) : `${hour}:${match[3]}`;
  return `Next: ${match[1]} ${clock} ${suffix}`;
}

function isPlanId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function PlanDetail({
  planId,
  onBack,
  onBookTele,
}: {
  planId: string;
  onBack: () => void;
  onBookTele: (choice: InsuranceBookingChoice) => void;
}) {
  const [plans, setPlans] = useState<PlanChoice[]>([]);
  const [activePlanId, setActivePlanId] = useState(isPlanId(planId) ? planId : '');
  const [companyName, setCompanyName] = useState('');
  const [vendors, setVendors] = useState<InsuranceVendorOption[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{ data?: { plans?: PlanChoice[] } }>('/customer/insurance/plans')
      .then((res) => {
        const next = res.data?.plans || [];
        setPlans(next);
        if (isPlanId(planId)) {
          const match = next.find((plan) => plan.id === planId);
          if (match) setCompanyName(match.companyName);
        }
      })
      .catch(() => setPlans([]));
  }, [planId]);

  useEffect(() => {
    if (!isPlanId(activePlanId)) {
      setVendors([]);
      return;
    }
    apiClient
      .get<{
        data?: {
          plan?: { name?: string; companyName?: string };
          vendors?: InsuranceVendorOption[];
        };
      }>(`/customer/insurance/plans/${activePlanId}`)
      .then((res) => {
        setCompanyName((current) => current || res.data?.plan?.companyName || '');
        setVendors(res.data?.vendors || []);
        setError('');
      })
      .catch(() => setError('This policy is not available.'));
  }, [activePlanId]);

  const companies = [...new Set(plans.map((plan) => plan.companyName).filter(Boolean))];
  const companyPlans = plans.filter((plan) => plan.companyName === companyName);
  const choicesReady = Boolean(companyName) && isPlanId(activePlanId);

  const book = (vendor: InsuranceVendorOption) => {
    const slot = vendor.slots[0];
    if (!choicesReady || !vendor.teleService || !slot) return;
    const typeName = companyPlans.find((plan) => plan.id === activePlanId)?.name || '';
    window.sessionStorage.setItem(
      'warmpawz-insurance-consult',
      JSON.stringify({ planId: activePlanId, companyName, coverType: typeName }),
    );
    onBookTele({ planId: activePlanId, vendor, slot });
  };

  return (
    <div className="min-h-screen bg-[#FFF8F3]">
      <header className="bg-gradient-to-br from-[#FF8C42] to-[#FF7A2F] px-4 pb-5 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label="Back to plans"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Consultation</p>
        <h1 className="text-xl font-bold">{companyName || 'Choose a company'}</h1>
      </header>
      <div className="space-y-4 px-4 py-4 pb-28">
        {error ? <p className="text-sm text-gray-600">{error}</p> : null}
        <label className="block text-sm font-medium text-gray-800">
          Company
          <select
            className="mt-1 w-full rounded-xl border border-orange-100 bg-white px-3 py-2"
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value);
              setActivePlanId('');
              setVendors([]);
              setError('');
            }}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Type of insurance
          <select
            className="mt-1 w-full rounded-xl border border-orange-100 bg-white px-3 py-2"
            value={companyPlans.some((plan) => plan.id === activePlanId) ? activePlanId : ''}
            disabled={!companyName}
            onChange={(event) => setActivePlanId(event.target.value)}
          >
            <option value="">Select type of insurance</option>
            {companyPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </label>

        {choicesReady ? (
        <section>
          <h2 className="text-sm font-semibold text-gray-800">Insurance providers</h2>
          <p className="mt-1 text-xs text-gray-500">Slots follow each provider’s tele availability.</p>
          {vendors.length === 0 && !error ? (
            <p className="mt-3 text-sm text-gray-600">No provider is available for this company yet.</p>
          ) : null}
          <div className="mt-3 space-y-3">
            {vendors.map((vendor) => (
              <article key={vendor.vendorId} className="rounded-2xl border border-orange-100 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">{vendor.name}</h3>
                <p className="text-xs text-gray-500">{vendor.teleService?.name || 'Tele Consultation'}</p>
                <p className="mt-2 text-sm font-semibold text-[#FF8C42]">{formatNextAvailability(vendor.nextTeleSlot || vendor.slots[0]?.label || null)}</p>
                <button
                  type="button"
                  disabled={!choicesReady || !vendor.teleService || vendor.slots.length === 0}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-[#FF8C42] text-sm font-bold text-white disabled:bg-slate-300"
                  onClick={() => book(vendor)}
                >
                  Book tele consultation
                </button>
                {!vendor.teleService ? (
                  <p className="mt-2 text-xs text-gray-500">Tele Consultation is not enabled for this provider.</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        ) : null}
      </div>
    </div>
  );
}
