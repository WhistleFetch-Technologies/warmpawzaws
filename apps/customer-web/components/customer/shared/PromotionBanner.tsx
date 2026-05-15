"use client";

import { useState, useEffect } from 'react';
import { X, Tag, Percent, Gift, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { resolvePromotionDestination } from '@/lib/promotion-navigation';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { parsePromotionApplicableServices, shouldIncludePromotionForService } from '@/lib/promotion-banner-filter';

interface Promotion {
  id: string;
  name: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  max_discount_amount?: number;
  is_spotlight?: boolean;
  priority?: number;
  promotion_type?: string;
  applicable_services?: string[] | any;
  service_category?: string;
  service_style?: string;
  metadata?: Record<string, unknown>;
}

interface PromotionBannerProps {
  service: string; // 'vet', 'grooming', 'training', etc.
  className?: string;
  maxPromotions?: number;
  showSpotlightOnly?: boolean;
  /** In-app navigation (CustomerHomeWrapper). When set, avoids broken `/${service}` full-page loads. */
  onNavigate?: (screen: string, data?: { promotionId?: string; promotionIntent?: Record<string, unknown>; serviceStyle?: string; [key: string]: unknown }) => void;
}

/**
 * Phase 0.1: Promotion Banner Component
 * Displays promotions for a specific service dashboard
 * Fetches from: GET /promotions/list?service={service}&published=true
 */
export function PromotionBanner({ 
  service, 
  className = '',
  maxPromotions = 3,
  showSpotlightOnly = false,
  onNavigate,
}: PromotionBannerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPromotions();
  }, [service, showSpotlightOnly]);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Phase 0.1: Fetch from new endpoint
      const params = new URLSearchParams({
        service: service,
        published: 'true',
      });
      
      if (showSpotlightOnly) {
        params.append('spotlight', 'true');
      }
      
      const response = await apiClient.get<any>(`/promotions/list?${params.toString()}`);
      
      let fetchedPromotions: Promotion[] = [];
      if (response?.success && response?.promotions) {
        fetchedPromotions = response.promotions;
      } else if (Array.isArray(response)) {
        fetchedPromotions = response;
      }
      
      // For home feed (`service=all`) include active published promos across categories.
      // Service-specific filtering applies only when rendering a specific vertical feed.
      if (fetchedPromotions.length > 0) {
        fetchedPromotions = fetchedPromotions.filter((promo: Promotion) => {
          return shouldIncludePromotionForService(promo, service);
        });
      }
      
      // Sort: spotlight first, then by priority (lower number = higher priority)
      fetchedPromotions.sort((a, b) => {
        // Spotlight promotions first
        if (a.is_spotlight && !b.is_spotlight) return -1;
        if (!a.is_spotlight && b.is_spotlight) return 1;
        
        // Then by priority (lower number = higher priority)
        const priorityA = a.priority || 999;
        const priorityB = b.priority || 999;
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        // Finally by created date (newer first)
        return 0;
      });
      
      // Limit to maxPromotions
      fetchedPromotions = fetchedPromotions.slice(0, maxPromotions);
      
      setPromotions(fetchedPromotions);
    } catch (err: any) {
      console.error('Error loading promotions:', err);
      setError('Failed to load promotions');
      // Graceful fallback - don't show error to user
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (promotionId: string) => {
    setDismissed(prev => new Set([...prev, promotionId]));
  };

  const navigateForPromotion = (promo: Promotion, source: string) => {
    apiClient.post(`/promotions/${promo.id}/click`, { source }).catch(() => {});
    const parsedApplicable = parsePromotionApplicableServices(promo.applicable_services);
    const styleToken = parsedApplicable.find((x) => x.startsWith('style:'));
    const categoryToken = parsedApplicable.find((x) => !x.startsWith('style:') && x.trim() !== '');
    const resolvedStyle =
      String(
        promo.service_style ??
        (promo as any).target_style ??
        (promo as any).targetStyle ??
        (styleToken ? styleToken.replace(/^style:/, '') : '') ??
        (promo.metadata as any)?.serviceStyle ??
        (promo.metadata as any)?.promotionTarget?.serviceStyle ??
        ''
      ).trim().toLowerCase();
    const resolvedCategory =
      String(
        promo.service_category ??
        (promo as any).target_category ??
        (promo as any).targetCategory ??
        categoryToken ??
        (promo.metadata as any)?.serviceCategory ??
        (promo.metadata as any)?.promotionTarget?.serviceCategory ??
        (service !== 'all' ? service : '')
      ).trim().toLowerCase();
    const promotionIntent = {
      promotionId: promo.id,
      serviceCategory: resolvedCategory,
      serviceStyle: resolvedStyle,
      clickedAt: Date.now(),
      source,
    };
    try {
      sessionStorage.setItem(
        'wp_promotion_cta',
        JSON.stringify(promotionIntent)
      );
    } catch {
      /* ignore */
    }
    let screen = resolvePromotionDestination(
      { ...(promo as Record<string, unknown>), service_category: resolvedCategory, service_style: resolvedStyle },
      service
    );
    if (screen === 'home') screen = 'services';
    if (onNavigate) {
      onNavigate(screen, {
        promotionId: promo.id,
        promotionIntent,
        ...(resolvedStyle ? { serviceStyle: resolvedStyle } : {}),
        ...(screen === 'vet-tele-consultation'
          ? { service: 'tele' as const, directTelePay: true as const }
          : {}),
      });
      return;
    }
    if (typeof window !== 'undefined') {
      if (screen === 'vet-tele-consultation') {
        const path = buildTeleInstantAutoPayBookingUrl();
        console.log('[PromotionBanner] no onNavigate → tele instant pay', path);
        window.location.href = `${window.location.origin}${path}`;
        return;
      }
      window.location.href = `/?promotion=${encodeURIComponent(promo.id)}&target=${encodeURIComponent(screen)}`;
    }
  };

  const formatDiscount = (promo: Promotion): string => {
    if (promo.discount_type === 'percentage' && promo.discount_value) {
      return `${promo.discount_value}% OFF`;
    } else if (promo.discount_type === 'fixed' && promo.discount_value) {
      return `₹${promo.discount_value} OFF`;
    }
    return 'SPECIAL OFFER';
  };

  const getPromotionIcon = (promo: Promotion) => {
    if (promo.is_spotlight) return <Sparkles className="w-4 h-4" />;
    if (promo.promotion_type === 'flash_sale') return <Tag className="w-4 h-4" />;
    if (promo.promotion_type === 'first_order') return <Gift className="w-4 h-4" />;
    return <Percent className="w-4 h-4" />;
  };

  if (loading) {
    return null; // Don't show loading state - just don't render until ready
  }

  if (error || promotions.length === 0) {
    return null; // Don't show error or empty state - just don't render
  }

  // Filter out dismissed promotions
  const visiblePromotions = promotions.filter(p => !dismissed.has(p.id));

  if (visiblePromotions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Spotlight Section */}
      {visiblePromotions.some(p => p.is_spotlight) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-700">Featured Offers</h3>
          </div>
          <div className="space-y-3">
            {visiblePromotions
              .filter(p => p.is_spotlight)
              .map((promo) => (
                <Card key={promo.id} className="w-full p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 relative">
                <button
                  onClick={() => handleDismiss(promo.id)}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    {getPromotionIcon(promo)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-yellow-500 text-white text-xs">
                        {formatDiscount(promo)}
                      </Badge>
                      {promo.is_spotlight && (
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                          Featured
                        </Badge>
                      )}
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 mb-1">{promo.name}</h4>
                    
                    {promo.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{promo.description}</p>
                    )}
                    
                    <Button
                      size="sm"
                      className="mt-2 bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
                      onClick={() => navigateForPromotion(promo, `${service}_spotlight`)}
                    >
                      Book Now
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Regular Promotions Section */}
      {visiblePromotions.some(p => !p.is_spotlight) && (
        <div className="space-y-2">
          {visiblePromotions.filter(p => !p.is_spotlight).length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Special Offers</h3>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {visiblePromotions
              .filter(p => !p.is_spotlight)
              .map((promo) => (
                <Card key={promo.id} className="w-full overflow-hidden border border-blue-100 rounded-3xl shadow-sm relative bg-white">
                <button
                  onClick={() => handleDismiss(promo.id)}
                  className="absolute top-2 right-2 z-10 p-1 hover:bg-white/80 rounded-full transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                
                <div className="h-full flex flex-col">
                  <div className="bg-gradient-to-br from-blue-50 to-sky-100 px-3 pt-4 pb-3 min-h-[110px] flex flex-col items-start">
                    <Badge className="bg-sky-500 text-white text-xs mb-3">
                      {formatDiscount(promo)}
                    </Badge>
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      {getPromotionIcon(promo)}
                    </div>
                  </div>

                  <div className="flex-1 p-3 flex flex-col">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-2 mb-1">
                        {promo.name}
                      </h4>

                      {promo.description ? (
                        <p className="text-sm text-gray-500 line-clamp-2">{promo.description}</p>
                      ) : (
                        <p className="text-sm text-gray-400 line-clamp-1">Limited time offer</p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      className="mt-3 w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl"
                      onClick={() => navigateForPromotion(promo, `${service}_regular`)}
                    >
                      Use
                    </Button>
                  </div>
                </div>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
