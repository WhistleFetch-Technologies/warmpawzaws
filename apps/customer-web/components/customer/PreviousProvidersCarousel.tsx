'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Calendar, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface PreviousProvider {
  providerId: string;
  providerName: string;
  providerImage?: string;
  serviceType: string;
  lastServiceDate: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  specialization: string;
  totalBookings: number;
}

interface PreviousProvidersCarouselProps {
  serviceType?: string;
  onSelectProvider?: (provider: PreviousProvider) => void;
  customerId?: string;
}

export function PreviousProvidersCarousel({
  serviceType,
  onSelectProvider,
  customerId
}: PreviousProvidersCarouselProps) {
  const [providers, setProviders] = useState<PreviousProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreviousProviders();
  }, [serviceType, customerId]);

  const fetchPreviousProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (serviceType) params.append('serviceType', serviceType);
      if (customerId) params.append('customerId', customerId);

      const data = await apiClient.get<{ providers?: PreviousProvider[] }>(
        `/home-services/providers/previous?${params}`
      );
      setProviders(data.providers || []);
    } catch (error) {
      console.error('Error fetching previous providers:', error);
      toast.error('Failed to load previous providers');
    } finally {
      setLoading(false);
    }
  };

  const handleRebook = (provider: PreviousProvider) => {
    if (onSelectProvider) {
      onSelectProvider(provider);
    } else {
      toast.success(`Rebooking with ${provider.providerName}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="flex items-center gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 bg-gray-100 rounded-xl h-40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Your Previous Service Providers
      </h2>
      <p className="text-gray-600 mb-4">
        Quickly rebook with providers you've used before
      </p>

      {/* Horizontal Scrollable Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {providers.map((provider) => (
          <div
            key={provider.providerId}
            className="flex-shrink-0 w-80 bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-orange-400 transition-all cursor-pointer group"
            onClick={() => handleRebook(provider)}
          >
            {/* Provider Header */}
            <div className="flex items-start gap-4 mb-4">
              {/* Provider Image */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white flex-shrink-0">
                {provider.providerImage ? (
                  <img
                    src={provider.providerImage}
                    alt={provider.providerName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold">
                    {provider.providerName.charAt(0)}
                  </span>
                )}
              </div>

              {/* Provider Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">
                  {provider.providerName}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-gray-900">
                      {Number(provider.rating || 0).toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    ({provider.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(provider.lastServiceDate)}</span>
              </div>

              {provider.distance != null && (
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{Number(provider.distance) < 1
                    ? `${Math.round(Number(provider.distance) * 1000)} m`
                    : `${Math.round(Number(provider.distance))} km`}</span>
                </div>
              )}
            </div>

            {/* Booking Count Badge */}
            <div className="flex items-center justify-between">
              <div className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm">
                {provider.totalBookings} previous booking{provider.totalBookings !== 1 ? 's' : ''}
              </div>

              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 group-hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRebook(provider);
                }}
              >
                Rebook
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
