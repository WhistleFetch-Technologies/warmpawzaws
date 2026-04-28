'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Star, MapPin, Clock, Shield, Sparkles, ChevronRight, Award, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { formatDistanceDisplay } from '@/lib/distance-display';

interface SponsoredProvider {
  id: string;
  vendorId: string;
  name: string;
  businessName?: string;
  role?: string;
  roleName?: string;
  roleDisplayName?: string;
  roleIcon?: string | null;
  roleImage?: string | null;
  photo?: string;
  rating: number;
  reviewCount: number;
  specialization?: string;
  qualifications?: string;
  distance?: number;
  isVerified?: boolean;
  nextAvailableSlot?: string;
  startingPrice?: number;
  completedServices?: number;
  campaignId?: string;
  // Sponsored ad data
  adCreative?: {
    title?: string;
    subtitle?: string;
    badge?: string;
  };
}

interface SponsoredProviderCardProps {
  provider: SponsoredProvider;
  category?: string; // For tracking
  position?: number; // Position in list for tracking
  variant?: 'card' | 'banner' | 'inline';
  onClick: (provider: SponsoredProvider) => void;
}

/**
 * SponsoredProviderCard - Displays a sponsored/featured provider with impression/click tracking
 */
export function SponsoredProviderCard({ 
  provider, 
  category,
  position = 0,
  variant = 'card',
  onClick 
}: SponsoredProviderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [impressionTracked, setImpressionTracked] = useState(false);

  // Track impression when card becomes visible
  useEffect(() => {
    if (!provider.campaignId || impressionTracked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !impressionTracked) {
            trackImpression();
            setImpressionTracked(true);
          }
        });
      },
      { threshold: 0.5 } // 50% visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [provider.campaignId, impressionTracked]);

  const trackImpression = async () => {
    try {
      await apiClient.post('/ads/impressions', {
        campaignId: provider.campaignId,
        vendorId: provider.vendorId,
        impressionType: 'vendor',
        targetId: provider.vendorId,
        targetType: 'vendor',
        position,
        category,
      });
    } catch (error) {
      // Silent fail - don't break UX for tracking
      console.debug('Failed to track impression:', error);
    }
  };

  const handleClick = async () => {
    // Track click
    if (provider.campaignId) {
      try {
        await apiClient.post('/ads/clicks', {
          campaignId: provider.campaignId,
          vendorId: provider.vendorId,
          clickType: 'vendor',
          targetId: provider.vendorId,
          targetType: 'vendor',
          position,
          category,
        });
      } catch (error) {
        console.debug('Failed to track click:', error);
      }
    }
    onClick(provider);
  };

  if (variant === 'banner') {
    return (
      <div
        ref={cardRef}
        onClick={handleClick}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-4 cursor-pointer hover:scale-[1.02] transition-transform"
      >
        {/* Sponsored Badge */}
        <div className="absolute top-2 right-2">
          <Badge className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
            <Sparkles className="w-3 h-3 mr-1" />
            Sponsored
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {/* Photo */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/20 flex-shrink-0">
            {provider.photo ? (
              <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                {provider.name?.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-white">
            <h3 className="font-bold text-lg">{provider.businessName || provider.name}</h3>
            {(provider.roleDisplayName || provider.role) && (
              <div className="mt-0.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-white/50 text-white">
                  {provider.roleDisplayName || provider.role}
                </Badge>
              </div>
            )}
            {provider.adCreative?.subtitle && (
              <p className="text-white/80 text-sm">{provider.adCreative.subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-white/90">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-white" />
                <span className="font-semibold">{provider.rating?.toFixed(1)}</span>
                <span className="opacity-70">({provider.reviewCount})</span>
              </div>
              {formatDistanceDisplay(provider) && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{formatDistanceDisplay(provider)}</span>
                </div>
              )}
            </div>
          </div>

          <ChevronRight className="w-6 h-6 text-white/70" />
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card
      ref={cardRef}
      onClick={handleClick}
      className="relative overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all"
    >
      {/* Sponsored Badge */}
      <div className="absolute top-3 right-3">
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-sm">
          <Sparkles className="w-3 h-3 mr-1" />
          Featured
        </Badge>
      </div>

      <div className="flex gap-4">
        {/* Photo */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 shadow-md">
            {provider.photo ? (
              <img 
                src={provider.photo} 
                alt={provider.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-orange-500">
                {provider.name?.charAt(0)}
              </div>
            )}
          </div>
          {provider.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
              <Shield className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">
            {provider.businessName || provider.name}
          </h3>

          {(provider.roleDisplayName || provider.role) && (
            <div className="mt-0.5">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                {provider.roleDisplayName || provider.role}
              </Badge>
            </div>
          )}
          
          {provider.specialization && (
            <p className="text-xs text-gray-500 truncate">{provider.specialization}</p>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-gray-700">{provider.rating?.toFixed(1)}</span>
              <span>({provider.reviewCount})</span>
            </div>
            {provider.completedServices && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-gray-400" />
                <span>{provider.completedServices}+ done</span>
              </div>
            )}
          </div>

          {/* Next Available */}
          {provider.nextAvailableSlot && (
            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <Clock className="w-3 h-3" />
              <span>Next: {provider.nextAvailableSlot}</span>
            </div>
          )}

          {/* Price */}
          {provider.startingPrice && (
            <div className="mt-2">
              <span className="text-xs text-gray-400">from </span>
              <span className="font-bold text-orange-600">₹{provider.startingPrice}</span>
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 self-center" />
      </div>
    </Card>
  );
}

/**
 * TopProvidersSection - Shows algorithmically ranked top providers
 */
interface TopProvidersSectionProps {
  category: string;
  serviceStyle?: string;
  limit?: number;
  onSelectProvider: (provider: any) => void;
}

export function TopProvidersSection({
  category,
  serviceStyle,
  limit = 5,
  onSelectProvider,
}: TopProvidersSectionProps) {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopProviders();
  }, [category, serviceStyle]);

  const loadTopProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        limit: limit.toString(),
        sortBy: 'score', // Server-side scoring
      });
      if (serviceStyle) params.append('serviceStyle', serviceStyle);

      const res = await apiClient.get<any>(`/providers/top?${params.toString()}`);
      setProviders(res?.providers || []);
    } catch (error) {
      console.error('Error loading top providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Top Rated
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-32 h-40 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900 flex items-center gap-2">
        <Award className="w-5 h-5 text-amber-500" />
        Top Rated Providers
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {providers.map((provider, idx) => (
          <Card
            key={provider.providerId || provider.id}
            onClick={() => onSelectProvider(provider)}
            className="w-32 flex-shrink-0 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="relative">
              <div className="w-32 h-24 bg-gradient-to-br from-gray-100 to-gray-200">
                {provider.photo ? (
                  <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300">
                    {provider.name?.charAt(0)}
                  </div>
                )}
              </div>
              {idx === 0 && (
                <Badge className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-1.5 py-0.5">
                  #1
                </Badge>
              )}
            </div>
            <div className="p-2">
              <h4 className="font-semibold text-xs text-gray-900 truncate">{provider.name}</h4>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium">{provider.rating?.toFixed(1)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * SimilarServicesSection - Shows related services/providers based on category
 */
interface SimilarServicesSectionProps {
  currentServiceId?: string;
  category: string;
  vendorId?: string;
  limit?: number;
  onSelectService: (service: any) => void;
}

export function SimilarServicesSection({
  currentServiceId,
  category,
  vendorId,
  limit = 4,
  onSelectService,
}: SimilarServicesSectionProps) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSimilarServices();
  }, [category, currentServiceId, vendorId]);

  const loadSimilarServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        limit: limit.toString(),
      });
      if (currentServiceId) params.append('excludeId', currentServiceId);
      if (vendorId) params.append('vendorId', vendorId);

      const res = await apiClient.get<any>(`/services/similar?${params.toString()}`);
      setServices(res?.services || []);
    } catch (error) {
      console.error('Error loading similar services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900">Similar Services</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (services.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900">You Might Also Like</h3>
      <div className="grid grid-cols-2 gap-3">
        {services.map((service) => (
          <Card
            key={service.id}
            onClick={() => onSelectService(service)}
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="h-16 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <span className="text-2xl">{service.icon || '🐾'}</span>
            </div>
            <div className="p-2">
              <h4 className="font-semibold text-xs text-gray-900 truncate">{service.name}</h4>
              {service.price && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">₹{service.price}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default SponsoredProviderCard;
