"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, Star, Sparkles, Gift, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

interface PreviousProvider {
  id: string;
  name: string;
  photo?: string | null;
  rating?: number;
  lastVisit?: string;
  serviceType: string;
  serviceLabel: string;
  screen: string;
}

interface ForYouSectionProps {
  phone: string;
  hotDeals?: any[];
  banners?: any[];
  onNavigate?: (screen: string, data?: any) => void;
}

const SERVICE_TYPES: { key: string; label: string; screen: string }[] = [
  { key: 'vet', label: 'Vet', screen: 'vet' },
  { key: 'grooming', label: 'Groomer', screen: 'grooming' },
  { key: 'walking', label: 'Walker', screen: 'walker' },
  { key: 'training', label: 'Training', screen: 'training' },
  { key: 'boarding', label: 'Boarding', screen: 'boarding' },
];

export function ForYouSection({ phone, hotDeals = [], banners = [], onNavigate }: ForYouSectionProps) {
  const [previousProviders, setPreviousProviders] = useState<PreviousProvider[]>([]);
  const [recommendedServices, setRecommendedServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ecommerceEnabled = isCustomerEcommerceEnabled();
  const visibleHotDeals = ecommerceEnabled ? hotDeals : [];

  // Phase 4: Service recommendations (when API exists - hide on 404/fail)
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!phone) return;
      try {
        const res = await apiClient.get<any>(`/customer/${phone}/recommended-services`).catch(() => null);
        if (res?.services && Array.isArray(res.services) && res.services.length > 0) {
          setRecommendedServices(res.services.slice(0, 3));
        }
      } catch { /* API may not exist yet */ }
    };
    loadRecommendations();
  }, [phone]);

  useEffect(() => {
    const load = async () => {
      if (!phone) { setLoading(false); return; }
      setLoading(true);
      try {
        const results: PreviousProvider[] = [];
        await Promise.all(
          SERVICE_TYPES.map(async ({ key, label, screen: screenName }) => {
            try {
              const res = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=${key}`);
              if (res?.provider) {
                results.push({
                  id: res.provider.id,
                  name: res.provider.businessName || res.provider.name,
                  photo: res.provider.photo,
                  rating: res.provider.rating,
                  lastVisit: res.provider.lastVisit,
                  serviceType: key,
                  serviceLabel: label,
                  screen: screenName,
                });
              }
            } catch { /* ignore */ }
          })
        );
        setPreviousProviders(results.slice(0, 3));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [phone]);

  const hasContent = previousProviders.length > 0 || visibleHotDeals.length > 0 || banners.length > 0 || recommendedServices.length > 0;
  if (!hasContent && !loading) return null;

  return (
    <div className="px-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-orange-500" />
        <h2 className="text-gray-900 text-sm font-semibold">For you</h2>
      </div>
      <div className="space-y-3">
        {/* Featured / Banners (Phase 3) */}
        {banners.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {banners.slice(0, 3).map((banner: any, idx: number) => (
              <button
                type="button"
                key={banner.id || idx}
                onClick={() => {
                  const raw = banner.link || banner.ctaLink || banner.url;
                  if (raw != null && String(raw).trim() !== '') {
                    const target = String(raw).trim();
                    if (!ecommerceEnabled && target.replace(/^\//, '').toLowerCase() === 'shop') return;
                    onNavigate?.(target);
                    return;
                  }
                  if (!ecommerceEnabled) return;
                  onNavigate?.('shop');
                }}
                className="flex-shrink-0 w-[160px] rounded-xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
              >
                {(banner.imageUrl || banner.image) ? (
                  <img src={banner.imageUrl || banner.image} alt={banner.title || 'Featured'} className="w-full h-20 object-cover" />
                ) : (
                  <div className="h-20 flex items-center justify-center">
                    <Star className="w-8 h-8 text-amber-500" />
                  </div>
                )}
                <div className="p-2 text-left">
                  <p className="text-xs font-semibold text-gray-900 truncate">{banner.title || 'Featured'}</p>
                  <p className="text-[10px] text-amber-600">Featured</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Book again */}
        {loading ? (
          <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ) : previousProviders.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {previousProviders.map((p) => (
              <button
                key={`${p.serviceType}-${p.id}`}
                onClick={() => onNavigate?.(p.screen, { vendorId: p.id })}
                className="flex-shrink-0 w-[140px] bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">
                      {p.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-0.5">
                      {p.rating && <Star className="w-2.5 h-2.5 fill-orange-500 text-orange-500" />}
                      {p.rating && <span>{p.rating}</span>}
                      <span>•</span>
                      <span>Book again</span>
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5">
                  <RefreshCw className="w-3 h-3" />
                  {p.serviceLabel}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {/* Phase 4: Recommended for you (when API returns data) */}
        {recommendedServices.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {recommendedServices.map((s: any, idx: number) => (
              <button
                key={s.id || idx}
                onClick={() => onNavigate?.(s.screen || s.category || 'vet', { serviceId: s.id })}
                className="flex-shrink-0 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 hover:shadow-md transition-shadow"
              >
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{s.name || s.serviceName || 'Recommended'}</p>
                  <p className="text-[10px] text-blue-600">Recommended for you</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {/* Deals */}
        {visibleHotDeals.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {visibleHotDeals.slice(0, 2).map((deal: any, idx: number) => (
              <button
                key={deal.id || idx}
                onClick={() => onNavigate?.('shop')}
                className="flex-shrink-0 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 hover:shadow-md transition-shadow"
              >
                <Gift className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{deal.title || 'Deal'}</p>
                  <p className="text-[10px] text-green-600 font-medium">{deal.discount || 'Off'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
