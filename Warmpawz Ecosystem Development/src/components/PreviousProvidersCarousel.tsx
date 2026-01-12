import React, { useState, useEffect } from 'react';
import { Heart, Star, Calendar, ArrowRight } from 'lucide-react';

/**
 * 👥 PREVIOUS PROVIDERS CAROUSEL
 * 
 * Phase 7C: Rule 2 - Home Services Enhancement
 * 
 * Features:
 * - Horizontal scrolling list of previous service providers
 * - Quick rebooking functionality
 * - Provider ratings and service history
 * - Favorite providers management
 */

interface PreviousProvider {
  providerId: string;
  providerName: string;
  serviceType: string;
  lastServiceDate: string;
  totalServices: number;
  rating: number;
  isFavorite: boolean;
  location?: { lat: number; lng: number };
  distance?: number;
}

interface PreviousProvidersCarouselProps {
  customerId: string;
  onBookProvider?: (provider: PreviousProvider) => void;
  apiUrl?: string;
}

export function PreviousProvidersCarousel({
  customerId,
  onBookProvider,
  apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475`,
}: PreviousProvidersCarouselProps) {
  const [providers, setProviders] = useState<PreviousProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, [customerId]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/home-services/providers/previous/${customerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load previous providers');
      }

      const data = await response.json();
      setProviders(data.data?.providers || []);
    } catch (err: any) {
      console.error('Error loading providers:', err);
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (provider: PreviousProvider) => {
    try {
      if (provider.isFavorite) {
        // Remove favorite
        await fetch(`${apiUrl}/home-services/providers/favorite/${customerId}/${provider.providerId}`, {
          method: 'DELETE',
        });
      } else {
        // Add favorite
        await fetch(`${apiUrl}/home-services/providers/favorite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            providerId: provider.providerId,
          }),
        });
      }

      // Update local state
      setProviders(prev =>
        prev.map(p =>
          p.providerId === provider.providerId
            ? { ...p, isFavorite: !p.isFavorite }
            : p
        )
      );
    } catch (err) {
      console.error('Error toggling favorite:', err);
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
        <h2 className="mb-4">Previous Service Providers</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="min-w-[280px] bg-gray-100 rounded-lg p-4 animate-pulse"
              style={{ height: '180px' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <h2 className="mb-4">Previous Service Providers</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="py-8">
        <h2 className="mb-4">Previous Service Providers</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          No previous service providers yet. Book your first service to see providers here!
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-4">
        <h2>Previous Service Providers</h2>
        <span className="text-sm text-gray-600">{providers.length} providers</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
        {providers.map(provider => (
          <div
            key={provider.providerId}
            className="min-w-[280px] bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow snap-start"
          >
            {/* Provider Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg mb-1">{provider.providerName}</h3>
                <p className="text-sm text-gray-600">{provider.serviceType}</p>
              </div>
              <button
                onClick={() => toggleFavorite(provider)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Heart
                  className={`w-5 h-5 ${
                    provider.isFavorite
                      ? 'fill-red-500 stroke-red-500'
                      : 'stroke-gray-400'
                  }`}
                />
              </button>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
              <span className="text-sm">
                {provider.rating.toFixed(1)} rating
              </span>
              <span className="text-xs text-gray-500">
                · {provider.totalServices} {provider.totalServices === 1 ? 'service' : 'services'}
              </span>
            </div>

            {/* Last Service Date */}
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Last service: {formatDate(provider.lastServiceDate)}</span>
            </div>

            {/* Book Again Button */}
            <button
              onClick={() => onBookProvider?.(provider)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span>Book Again</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Scroll Indicator */}
      {providers.length > 3 && (
        <div className="text-center mt-2 text-sm text-gray-500">
          Scroll to see more →
        </div>
      )}
    </div>
  );
}
