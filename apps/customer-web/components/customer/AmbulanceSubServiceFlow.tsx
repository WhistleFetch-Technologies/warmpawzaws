'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { AmbulanceBookingFlow } from './specialized/AmbulanceBookingFlow';

export type AmbulanceSubServiceMode = 'schedule' | 'transfer';

interface AmbulanceSubServiceFlowProps {
  phone: string;
  mode: AmbulanceSubServiceMode;
  onBack: () => void;
  onSuccess?: (bookingId: string) => void;
}

function normalizeVendorId(entry: any, index: number): string | null {
  const id = entry?.vendorId ?? entry?.vendor_id ?? entry?.id;
  if (id && String(id).trim()) return String(id);
  return null;
}

export function AmbulanceSubServiceFlow({ phone, mode, onBack, onSuccess }: AmbulanceSubServiceFlowProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const initialEmergencyType = mode === 'transfer' ? 'transfer' : 'other';
  const title = mode === 'transfer' ? 'Inter-hospital transfer' : 'Schedule a ride';
  const subtitle =
    mode === 'transfer'
      ? 'Choose a provider and enter pickup and destination (hospital or address).'
      : 'Book a non-emergency ambulance for vet visits.';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<{ services?: any[]; vendors?: any[] }>(
          `/customer/services?roleId=pet_ambulance`
        );
        const list = data.services || data.vendors || [];
        if (!cancelled) setVendors(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setVendors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (selectedVendorId) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-8">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedVendorId(null)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">{title}</h1>
            <p className="text-xs text-gray-500">Enter details to confirm</p>
          </div>
        </div>
        <div className="p-4">
          <AmbulanceBookingFlow
            vendorId={selectedVendorId}
            customerPhone={phone}
            initialEmergencyType={initialEmergencyType}
            lockEmergencyType
            allowPlaceholderVehicleWhenEmpty
            onCancel={() => setSelectedVendorId(null)}
            onSuccess={(id) => onSuccess?.(id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 pt-6 pb-10">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-white/85 text-sm mt-2">{subtitle}</p>
      </div>

      <div className="px-4 -mt-6 pb-24">
        <Card className="p-4 shadow-md border-slate-100">
          {loading ? (
            <p className="text-center text-gray-500 py-10">Loading ambulance providers…</p>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-600 text-sm">No pet ambulance providers are listed in your area yet.</p>
              <p className="text-xs text-gray-500">Try Emergency SOS from the previous screen for urgent help, or check back later.</p>
              <Button type="button" variant="outline" className="mt-2" onClick={onBack}>
                Back to ambulance services
              </Button>
            </div>
          ) : vendors.every((v, i) => !normalizeVendorId(v, i)) ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-600 text-sm">Provider listings are missing details. Please try again later or use Emergency SOS.</p>
              <Button type="button" variant="outline" onClick={onBack}>
                Back to ambulance services
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {vendors
                .map((v, i) => ({ v, i, id: normalizeVendorId(v, i) }))
                .filter((row): row is { v: any; i: number; id: string } => !!row.id)
                .map(({ v, i, id }) => {
                  const name = v.vendorName || v.name || v.businessName || 'Ambulance provider';
                  return (
                    <li key={`${id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedVendorId(id)}
                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/80 transition-colors"
                      >
                        <div className="font-semibold text-gray-900">{name}</div>
                        {(v.phone || v.contactPhone) && (
                          <div className="text-sm text-gray-500 mt-0.5">{v.phone || v.contactPhone}</div>
                        )}
                        {v.distance != null && (
                          <div className="text-xs text-gray-400 mt-1">
                            {typeof v.distance === 'string' ? v.distance : `${v.distance} km`}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
