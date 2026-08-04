'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Home, Package, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import {
  fetchWalkerVendorCatalogMerged,
  getWalkerDisplayOfferings,
  mapWalkerApiRowToOption,
  type WalkerServiceOption,
} from '@/lib/walker-vendor-offerings';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';

export type WalkerWalkPickerSelection = {
  option: WalkerServiceOption;
  rawRow: Record<string, unknown> | null;
};

function indexRawRowsByVendorServiceId(
  catalog: { services: unknown[]; packages: unknown[] } | null
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!catalog) return map;
  const rows = mergeCustomerVendorServicesPayload(catalog);
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const s = row as Record<string, unknown>;
    const id = String(s.id ?? s.vendorServiceId ?? '').trim();
    if (id) map.set(id, s);
  }
  return map;
}

export interface WalkerWalkServicePickerProps {
  vendorId: string;
  phone?: string;
  bookingServiceStyle?: string;
  selectedId: string;
  onSelect: (selection: WalkerWalkPickerSelection) => void;
  onOfferingsCountChange?: (count: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** Profile: show all walk-like services; booking wizard: match at_home/outdoor style. */
  requireStyleMatch?: boolean;
}

export function WalkerWalkServicePicker({
  vendorId,
  phone,
  bookingServiceStyle = 'at_home',
  selectedId,
  onSelect,
  onOfferingsCountChange,
  onLoadingChange,
  requireStyleMatch = true,
}: WalkerWalkServicePickerProps) {
  const [loading, setLoading] = useState(true);
  const [vendorCatalog, setVendorCatalog] = useState<{
    services: unknown[];
    packages: unknown[];
  } | null>(null);
  const rawByIdRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    autoSelectedRef.current = false;
    let cancelled = false;
    (async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        const catalog = await fetchWalkerVendorCatalogMerged(
          (url) => apiClient.get(url),
          vendorId,
          phone
        );
        if (cancelled) return;
        setVendorCatalog(catalog);
        rawByIdRef.current = indexRawRowsByVendorServiceId(catalog);
      } catch {
        if (!cancelled) setVendorCatalog({ services: [], packages: [] });
      } finally {
        if (!cancelled) {
          setLoading(false);
          onLoadingChange?.(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, phone]);

  const serviceOptions: WalkerServiceOption[] = useMemo(() => {
    if (!vendorCatalog) return [];
    const rows = getWalkerDisplayOfferings(vendorCatalog, bookingServiceStyle, {
      requireStyleMatch,
    });
    return rows.map((r) => mapWalkerApiRowToOption(r, bookingServiceStyle));
  }, [vendorCatalog, bookingServiceStyle, requireStyleMatch]);

  const singleWalkOptions = useMemo(
    () => serviceOptions.filter((o) => !o.isPackage),
    [serviceOptions]
  );
  const bundleOptions = useMemo(
    () => serviceOptions.filter((o) => o.isPackage),
    [serviceOptions]
  );

  useEffect(() => {
    onOfferingsCountChange?.(serviceOptions.length);
  }, [serviceOptions.length, onOfferingsCountChange]);

  useEffect(() => {
    if (loading || autoSelectedRef.current || serviceOptions.length !== 1) return;
    const only = serviceOptions[0]!;
    autoSelectedRef.current = true;
    onSelect({
      option: only,
      rawRow: rawByIdRef.current.get(only.id) ?? null,
    });
  }, [loading, serviceOptions, onSelect]);

  const emitSelect = (service: WalkerServiceOption) => {
    onSelect({
      option: service,
      rawRow: rawByIdRef.current.get(service.id) ?? null,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  if (singleWalkOptions.length === 0 && bundleOptions.length === 0) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
        No published walks for this walker yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Choose a walk or bundle</h2>
        <p className="text-sm text-gray-500 mt-1">
          Single sessions are priced per walk. Bundles are multi-session packages (total price shown).
        </p>
      </div>
      {[
        { title: 'Single walks', list: singleWalkOptions },
        { title: 'Walk bundles (packages)', list: bundleOptions },
      ].map(({ title, list }) =>
        list.length === 0 ? null : (
          <div key={title} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
            <div className="space-y-3">
              {list.map((service) => {
                const Icon = service.isPackage ? Package : Home;
                const isSelected = selectedId === service.id;
                const colorBox =
                  service.iconColor === 'blue'
                    ? 'bg-blue-100 text-blue-600'
                    : service.iconColor === 'purple'
                      ? 'bg-purple-100 text-purple-700'
                      : service.iconColor === 'green'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-[#FF8C42]';
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => emitSelect(service)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${colorBox}`}
                      >
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                              service.isPackage
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {service.isPackage ? 'Package' : 'Service'}
                          </span>
                        </div>
                        {(service.desc ?? '').trim() ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ServiceDescriptionInline
                              description={service.desc!}
                              title={service.name}
                              className="m-0 text-sm leading-5 text-gray-500"
                              dialogHint="Full description from the walker (vendor-provided)"
                            />
                          </div>
                        ) : null}
                        {service.subPriceHint ? (
                          <p className="text-xs text-gray-500 mt-0.5">{service.subPriceHint}</p>
                        ) : null}
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {service.isPackage
                              ? `${service.duration} min / session${
                                  service.totalSessions != null
                                    ? ` · ${service.totalSessions} sessions`
                                    : ''
                                }`
                              : `${service.duration} mins`}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg text-gray-900">{service.priceLabel}</p>
                        {isSelected ? (
                          <CheckCircle2 className="w-6 h-6 text-[#FF8C42] mt-1 ml-auto" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
