'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface VendorOption {
  vendorId: string;
  name: string;
  rating: number | null;
  nextTeleSlot: string | null;
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
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [petId, setPetId] = useState('');
  const [pets, setPets] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    apiClient.get<{ data?: { plan?: { name?: string }; vendors?: VendorOption[] } }>(`/customer/insurance/plans/${planId}`).then((res) => {
      setPlanName(res.data?.plan?.name || 'Plan');
      setVendors(res.data?.vendors || []);
    }).catch(() => setPlanName('Plan'));
    const customerId = window.localStorage.getItem('customerId') || '';
    if (!customerId) return;
    apiClient.get<{ pets?: Array<{ id: string; name: string }> }>(`/customer/${customerId}/pets`).then((res) => {
      setPets(res.pets || []);
    }).catch(() => setPets([]));
  }, [planId]);

  return (
    <div className="min-h-screen bg-white">
      <button type="button" className="px-4 py-3 text-sm font-semibold" onClick={onBack}>Back</button>
      <div className="px-4 pb-8">
        <h1 className="text-xl font-bold">{planName}</h1>
        <label className="mt-4 block text-sm font-medium">
          Pet
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={petId} onChange={(e) => setPetId(e.target.value)}>
            <option value="">Select a pet</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
          </select>
        </label>
        <h2 className="mt-6 text-sm font-semibold text-gray-700">Choose an advisor</h2>
        <div className="mt-2 space-y-2">
          {vendors.map((vendor) => (
            <button
              key={vendor.vendorId}
              type="button"
              disabled={!petId}
              className="w-full rounded-xl border px-3 py-3 text-left disabled:opacity-50"
              onClick={() => {
                window.sessionStorage.setItem('warmpawz-insurance-consult', JSON.stringify({ planId, petId }));
                onBookTele(vendor);
              }}
            >
              <span className="block font-semibold">{vendor.name}</span>
              <span className="text-xs text-gray-500">
                {vendor.rating != null ? `Rating ${vendor.rating}` : 'Teleconsultation'}
                {vendor.nextTeleSlot ? ` · Next ${vendor.nextTeleSlot}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
