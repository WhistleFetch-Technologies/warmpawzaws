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
  vendor: InsuranceVendorOption;
  slot: TeleSlot;
}

function optionLabel(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const row = value as { label?: string; name?: string; key?: string };
    return String(row.label || row.name || row.key || '').trim();
  }
  return '';
}

function ChoiceSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <label className="block text-sm font-medium text-gray-800">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-orange-100 bg-white px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
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
  const [planName, setPlanName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vendors, setVendors] = useState<InsuranceVendorOption[]>([]);
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [sumInsuredOptions, setSumInsuredOptions] = useState<string[]>([]);
  const [copayOptions, setCopayOptions] = useState<string[]>([]);
  const [coverType, setCoverType] = useState('');
  const [sumInsured, setSumInsured] = useState('');
  const [copay, setCopay] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{
        data?: {
          plan?: { name?: string; companyName?: string };
          vendors?: InsuranceVendorOption[];
          coverOptions?: unknown[];
          sumInsuredOptions?: unknown[];
          copayOptions?: unknown[];
        };
      }>(`/customer/insurance/plans/${planId}`)
      .then((res) => {
        const covers = (res.data?.coverOptions || []).map(optionLabel).filter(Boolean);
        const sums = (res.data?.sumInsuredOptions || []).map(optionLabel).filter(Boolean);
        const copays = (res.data?.copayOptions || []).map(optionLabel).filter(Boolean);
        setPlanName(res.data?.plan?.name || 'Policy');
        setCompanyName(res.data?.plan?.companyName || '');
        setVendors(res.data?.vendors || []);
        setCoverOptions(covers);
        setSumInsuredOptions(sums);
        setCopayOptions(copays);
        setCoverType(covers.length === 1 ? covers[0] : '');
        setSumInsured(sums.length === 1 ? sums[0] : '');
        setCopay(copays.length === 1 ? copays[0] : '');
      })
      .catch(() => setError('This policy is not available.'));
  }, [planId]);

  const choicesReady =
    (coverOptions.length === 0 || Boolean(coverType)) &&
    (sumInsuredOptions.length === 0 || Boolean(sumInsured)) &&
    (copayOptions.length === 0 || Boolean(copay));

  const book = (vendor: InsuranceVendorOption, slot: TeleSlot) => {
    if (!choicesReady || !vendor.teleService) return;
    window.sessionStorage.setItem(
      'warmpawz-insurance-consult',
      JSON.stringify({ planId, companyName, coverType, sumInsured, copay }),
    );
    onBookTele({ vendor, slot });
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
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Company</p>
        <h1 className="text-xl font-bold">{companyName || 'Insurance company'}</h1>
        <p className="mt-0.5 text-sm text-white/90">{planName}</p>
      </header>
      <div className="space-y-4 px-4 py-4 pb-28">
        {error ? <p className="text-sm text-gray-600">{error}</p> : null}
        <ChoiceSelect label="Type of insurance" options={coverOptions} value={coverType} onChange={setCoverType} />
        <ChoiceSelect label="Sum insured" options={sumInsuredOptions} value={sumInsured} onChange={setSumInsured} />
        <ChoiceSelect label="Copay" options={copayOptions} value={copay} onChange={setCopay} />

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
                {vendor.slots.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500">No upcoming tele slot.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vendor.slots.map((slot) => (
                      <button
                        key={`${vendor.vendorId}-${slot.date}-${slot.time}`}
                        type="button"
                        disabled={!choicesReady || !vendor.teleService}
                        className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold text-[#FF8C42] disabled:border-slate-200 disabled:text-slate-400"
                        onClick={() => book(vendor, slot)}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
                {!vendor.teleService ? (
                  <p className="mt-2 text-xs text-gray-500">Tele Consultation is not enabled for this provider.</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
