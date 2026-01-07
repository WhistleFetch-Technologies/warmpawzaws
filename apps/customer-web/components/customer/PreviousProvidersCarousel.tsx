'use client';

import React, { useState, useEffect } from 'react';
import { Star, MapPin, Calendar, ArrowRight, Clock } from 'lucide-react';
import Image from 'next/image';
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

      const response = await apiClient.get<{ providers: PreviousProvider[] }>(
        `/home-services/providers/previous?${params}`
      );
      
      if (response.providers) {
        setProviders(response.providers);
      }
    } catch (error) {
      console.error('Error fetching previous providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRebook = (provider: PreviousProvider) => {
    if (onSelectProvider) {
      onSelectProvider(provider);
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
            onClick={() => handleRebook(provider)}
            className="flex-shrink-0 w-80 bg-white rounded-xl border-2 border-gray-200 p-0 hover:border-primary transition-all cursor-pointer group active:scale-[0.98]"
          >
            {/* Provider Header */}
            <div className="flex items-start gap-4 mb-4">
              {/* Provider Image */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white flex-shrink-0">
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
                <p className="text-sm text-gray-600 truncate">
                  {provider.specialization}
                </p>

                {/* Rating */}
                <div className="flex items-center gap-0 mt-0">
                  <div className="flex items-center gap-0">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold">{provider.rating.toFixed(1)}</span>
                  </div>
                  {provider.reviewCount > 0 && (
                    <span className="text-sm text-gray-600">({provider.reviewCount})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Service Info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-0 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Last service: {formatDate(provider.lastServiceDate)}</span>
              </div>
              {provider.distance && (
                <div className="flex items-center gap-0 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{provider.distance.toFixed(1)} km away</span>
                </div>
              )}
              <div className="text-sm text-gray-600">
                {provider.totalBookings} booking{provider.totalBookings !== 1 ? 's' : ''} with this provider
              </div>
            </div>

            {/* Rebook Button */}
            <button className="w-full py-0 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-0">
              Rebook Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

