"use client";

import { useState, useEffect } from 'react';
import { X, Tag, Percent, Gift, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

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
}

interface PromotionBannerProps {
  service: string; // 'vet', 'grooming', 'training', etc.
  className?: string;
  maxPromotions?: number;
  showSpotlightOnly?: boolean;
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
  showSpotlightOnly = false 
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
      
      // Filter by service if applicable_services field exists
      if (fetchedPromotions.length > 0) {
        fetchedPromotions = fetchedPromotions.filter((promo: Promotion) => {
          // If no applicable_services, show to all services
          if (!promo.applicable_services || 
              (Array.isArray(promo.applicable_services) && promo.applicable_services.length === 0)) {
            return true;
          }
          
          // Check if service is in applicable_services
          const services = Array.isArray(promo.applicable_services) 
            ? promo.applicable_services 
            : (typeof promo.applicable_services === 'string' ? JSON.parse(promo.applicable_services) : []);
          
          return services.includes(service);
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
          {visiblePromotions
            .filter(p => p.is_spotlight)
            .map((promo) => (
              <Card key={promo.id} className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 relative">
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
                      onClick={() => {
                        // Track promotion click
                        apiClient.post(`/promotions/${promo.id}/click`, {
                          source: `${service}_spotlight`
                        }).catch(() => {}); // Silent fail for tracking
                        // Navigate to booking or apply promotion
                        window.location.href = `/${service}?promotion=${promo.id}`;
                      }}
                    >
                      Book Now
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
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
          {visiblePromotions
            .filter(p => !p.is_spotlight)
            .map((promo) => (
              <Card key={promo.id} className="p-3 bg-blue-50 border-blue-200 relative">
                <button
                  onClick={() => handleDismiss(promo.id)}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getPromotionIcon(promo)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-blue-500 text-white text-xs">
                        {formatDiscount(promo)}
                      </Badge>
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{promo.name}</h4>
                    
                    {promo.description && (
                      <p className="text-xs text-gray-600 line-clamp-1">{promo.description}</p>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
                    onClick={() => {
                      // Track promotion click
                      apiClient.post(`/promotions/${promo.id}/click`, {
                        source: `${service}_regular`
                      }).catch(() => {}); // Silent fail for tracking
                      window.location.href = `/${service}?promotion=${promo.id}`;
                    }}
                  >
                    Use
                  </Button>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
