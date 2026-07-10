"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Star, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { resolveFeaturedVendorDestination } from '@/lib/promotion-navigation';
import {
  isStyleLaunchedForCustomer,
  loadCustomerServiceLaunchCatalog,
} from '@/lib/customer-service-style-launch';
import { resolveStyleLaunchTargetForScreen } from '@/lib/customer-style-screen-launch';

export interface FeaturedVendorSpotlightsProps {
  /**
   * Same `service` context as this screen (e.g. `grooming`, `vet`, `sitting`, `veterinary`).
   * Sent as GET /customer/featured-vendors?service=…&limit=…
   */
  service: string;
  phone?: string;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
  className?: string;
  limit?: number;
}

export function FeaturedVendorSpotlights({
  service,
  phone,
  onNavigate,
  className = '',
  limit = 6,
}: FeaturedVendorSpotlightsProps) {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);

  const filterVendorsByLaunch = useCallback(
    async (list: any[]) => {
      if (!phone || !list.length) return list;
      const catalog = await loadCustomerServiceLaunchCatalog(phone);
      if (!catalog.length) return list;
      return list.filter((v) => {
        const dest = resolveFeaturedVendorDestination(v);
        if (dest.kind !== 'screen') return true;
        const target = resolveStyleLaunchTargetForScreen(dest.screen, v as Record<string, unknown>);
        if (!target) return true;
        return isStyleLaunchedForCustomer(catalog, target.serviceId, target.serviceStyle);
      });
    },
    [phone]
  );

  const navigateFromVendor = useCallback(
    (v: Record<string, unknown>) => {
      const dest = resolveFeaturedVendorDestination(v);
      const rawId = v.vendorId ?? v.vendor_id ?? v.id;
      const base =
        rawId != null && String(rawId).trim() !== ''
          ? { ...v, vendorId: String(rawId) }
          : { ...v };
      const data = base as Record<string, unknown>;

      if (dest.kind === 'external') {
        window.location.assign(dest.url);
        return;
      }
      if (dest.kind === 'router') {
        const path = dest.path.startsWith('/') ? dest.path : `/${dest.path}`;
        router.push(path);
        return;
      }
      onNavigate?.(dest.screen, data);
    },
    [onNavigate, router]
  );

  useEffect(() => {
    if (!service?.trim()) {
      setVendors([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ service: service.trim(), limit: String(limit) });
        if (phone) params.set('phone', phone);
        const res = await apiClient.get<any>(`/customer/featured-vendors?${params.toString()}`);
        if (cancelled) return;
        const list = res?.vendors;
        if (Array.isArray(list) && list.length > 0) {
          const filtered = await filterVendorsByLaunch(list);
          setVendors(filtered);
        } else {
          setVendors([]);
        }
      } catch {
        if (!cancelled) setVendors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service, limit, phone, filterVendorsByLaunch]);

  if (vendors.length === 0) {
    return null;
  }

  return (
    <div className={className || 'mb-0'}>
      <div className="px-4 mb-3 sm:px-0">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-slate-900">Featured providers</h2>
        </div>
        <p className="text-xs text-slate-600">Hand-picked by us</p>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-0 -mx-0">
        {vendors.map((v: any) => (
          <button
            key={v.id}
            type="button"
            onClick={() => navigateFromVendor(v as Record<string, unknown>)}
            className="flex-shrink-0 w-36 bg-white rounded-2xl border border-gray-200 p-4 text-left shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
          >
            <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 mb-3 overflow-hidden">
              {v.imageUrl ? (
                <img src={v.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Star className="w-8 h-8 text-amber-400" />
                </div>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-800 truncate">{v.vendorName || v.title}</h3>
            {v.subtitle && <p className="text-xs text-gray-600 truncate mt-0.5">{v.subtitle}</p>}
            <span className="text-xs text-amber-600 font-medium mt-2 inline-flex items-center gap-1">
              {v.ctaText || 'Book'} <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
