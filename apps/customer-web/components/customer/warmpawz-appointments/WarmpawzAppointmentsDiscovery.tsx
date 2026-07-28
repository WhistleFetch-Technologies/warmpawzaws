'use client';

import { useState } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import { ChevronLeft, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  useWarmpawzAppointmentsDiscovery,
  type WapptStyleFilter,
} from '@/hooks/useWarmpawzAppointmentsDiscovery';
import { getWarmpawzAppointmentBookingTitle } from '@/lib/warmpawz-appointments-customer';

const STYLE_FILTERS: { id: WapptStyleFilter; label: string }[] = [
  { id: 'all', label: 'View all' },
  { id: 'at_center', label: 'At centre' },
  { id: 'at_home', label: 'At home' },
];

type WarmpawzAppointmentsDiscoveryProps = {
  category: string;
  onBack: () => void;
  onVendorSelect: (vendor: { vendorId: string; vendorName: string; serviceStyle: string }) => void;
};

export function WarmpawzAppointmentsDiscovery({
  category,
  onBack,
  onVendorSelect,
}: WarmpawzAppointmentsDiscoveryProps) {
  const [styleFilter, setStyleFilter] = useState<WapptStyleFilter>('all');
  const { vendors, loading, error, hasMore, loadMore } = useWarmpawzAppointmentsDiscovery({
    category,
    serviceStyle: styleFilter,
  });
  const { title, subtitle } = getWarmpawzAppointmentBookingTitle(category);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {STYLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStyleFilter(f.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                styleFilter === f.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 p-4">
        {error ? (
          <Card className="p-6 text-center text-sm text-red-600">{error}</Card>
        ) : null}
        {loading && vendors.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading providers…</p>
        ) : null}
        {!loading && vendors.length === 0 && !error ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">No appointment providers published for this category yet.</p>
          </Card>
        ) : null}
        {vendors.map((v) => (
          <button
            key={v.vendorId}
            type="button"
            className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-orange-200"
            onClick={() =>
              onVendorSelect({
                vendorId: v.vendorId,
                vendorName: v.name,
                serviceStyle: styleFilter === 'all' ? 'at_center' : styleFilter,
              })
            }
          >
            <div className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-orange-50">
                {v.photoUrl ? (
                  <CachedImage src={v.photoUrl} alt="" fill className="object-cover" sizes="56px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-orange-400">
                    {v.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900">{v.name}</h3>
                <p className="text-xs text-slate-500">{v.roleDisplayName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {v.rating > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {v.rating.toFixed(1)}
                      {v.reviewCount > 0 ? ` (${v.reviewCount})` : ''}
                    </span>
                  ) : null}
                  {v.shortAddress ? (
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {v.shortAddress}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-orange-600">{v.availabilityText}</p>
              </div>
            </div>
          </button>
        ))}
        {hasMore ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" disabled={loading} onClick={loadMore}>
              {loading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
