'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorOption {
  vendorId: string;
  name: string;
  rating: number | null;
  nextTeleSlot: string | null;
}

function readCustomerPhone(): string {
  const stored = ['customerPhone', 'customer_phone', 'phone']
    .map((key) => window.localStorage.getItem(key)?.trim() || '')
    .find(Boolean);
  if (stored) return stored;
  try {
    const data = JSON.parse(window.localStorage.getItem('customerData') || '{}') as { phone?: string; mobile?: string };
    return String(data.phone || data.mobile || '').trim();
  } catch {
    return '';
  }
}

function petsFromResponse(res: unknown): Array<{ id: string; name: string }> {
  const body = res as { pets?: unknown; data?: { pets?: unknown } };
  const raw = Array.isArray(body?.pets) ? body.pets : Array.isArray(body?.data?.pets) ? body.data.pets : [];
  return raw
    .map((pet) => {
      const row = pet as { id?: string; name?: string };
      return { id: String(row.id || ''), name: String(row.name || '').trim() || 'Unnamed' };
    })
    .filter((pet) => pet.id);
}

export function PlanDetail({
  planId,
  onBack,
  onBookTele,
}: {
  planId: string;
  onBack: () => void;
  onBookTele: (vendor: VendorOption) => void;
}) {
  const [planName, setPlanName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [petId, setPetId] = useState('');
  const [pets, setPets] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{ data?: { plan?: { name?: string; companyName?: string }; vendors?: VendorOption[] } }>(
        `/customer/insurance/plans/${planId}`,
      )
      .then((res) => {
        setPlanName(res.data?.plan?.name || 'Policy');
        setCompanyName(res.data?.plan?.companyName || '');
        setVendors(res.data?.vendors || []);
      })
      .catch(() => setError('This policy is not available.'));

    const phone = readCustomerPhone();
    const customerId = window.localStorage.getItem('customerId') || '';
    const petsUrl = phone
      ? `/customer/pets/${encodeURIComponent(phone)}`
      : customerId
        ? `/customer/${customerId}/pets`
        : '';
    if (!petsUrl) return;
    apiClient
      .get<unknown>(petsUrl)
      .then((res) => setPets(petsFromResponse(res)))
      .catch(() => setPets([]));
  }, [planId]);

  const book = (vendor: VendorOption) => {
    window.sessionStorage.setItem('warmpawz-insurance-consult', JSON.stringify({ planId, petId, companyName }));
    onBookTele(vendor);
  };

  const onlyVendor = vendors.length === 1 ? vendors[0] : null;

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
      <div className="px-4 py-4">
        {error ? <p className="text-sm text-gray-600">{error}</p> : null}
        <label className="block text-sm font-medium text-gray-800">
          Pet
          <select className="mt-1 w-full rounded-xl border border-orange-100 bg-white px-3 py-2" value={petId} onChange={(e) => setPetId(e.target.value)}>
            <option value="">{pets.length === 0 ? 'No pets on this account' : 'Select a pet'}</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
          </select>
        </label>
        {pets.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">Add a pet from your profile, then come back to book.</p>
        ) : null}

        {vendors.length === 0 && !error ? (
          <p className="mt-6 text-sm text-gray-600">No advisor is available for this company yet.</p>
        ) : null}

        {onlyVendor ? (
          <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Teleconsultation</h2>
            <p className="mt-1 text-sm text-gray-700">{onlyVendor.name}</p>
            <p className="text-xs text-gray-500">
              {onlyVendor.nextTeleSlot ? `Next slot ${onlyVendor.nextTeleSlot}` : 'Uses this advisor’s tele availability'}
            </p>
            <button
              type="button"
              disabled={!petId}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C42] text-sm font-bold text-white disabled:bg-slate-300"
              onClick={() => book(onlyVendor)}
            >
              Book with {onlyVendor.name}
            </button>
          </div>
        ) : null}

        {vendors.length > 1 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-800">Choose an advisor</h2>
            <p className="mt-1 text-xs text-gray-500">Each advisor uses the tele times set on their own profile.</p>
            <div className="mt-2 space-y-2">
              {vendors.map((vendor) => (
                <button
                  key={vendor.vendorId}
                  type="button"
                  disabled={!petId}
                  className="w-full rounded-xl border border-orange-100 bg-white px-3 py-3 text-left disabled:opacity-50"
                  onClick={() => book(vendor)}
                >
                  <span className="block font-semibold text-gray-900">{vendor.name}</span>
                  <span className="text-xs text-gray-500">
                    {vendor.nextTeleSlot ? `Next slot ${vendor.nextTeleSlot}` : 'Teleconsultation'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
