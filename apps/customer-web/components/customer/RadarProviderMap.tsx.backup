'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, List, Map } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Provider {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  distance?: number;
  rating?: number;
  type: 'vendor' | 'staff' | 'center';
}

interface RadarProviderMapProps {
  providers: Provider[];
  userLocation?: { lat: number; lng: number };
  onProviderSelect?: (provider: Provider) => void;
  className?: string;
}

export function RadarProviderMap({
  providers,
  userLocation,
  onProviderSelect,
  className = ''
}: RadarProviderMapProps) {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const handleProviderClick = (provider: Provider) => {
    setSelectedProvider(provider);
    onProviderSelect?.(provider);
  };

  return (
    <div className={className}>
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Nearby Providers</h3>
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Map className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="bg-gray-200 rounded-2xl h-96 flex items-center justify-center relative overflow-hidden">
          {/* Map Placeholder - In production, integrate with Google Maps or Mapbox */}
          <div className="text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Map view coming soon</p>
            <p className="text-sm text-gray-500 mt-2">{providers.length} providers nearby</p>
          </div>
          
          {/* User Location Marker */}
          {userLocation && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              onClick={() => handleProviderClick(provider)}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                  {provider.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{provider.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    {provider.distance && (
                      <div className="flex items-center gap-1">
                        <Navigation className="w-4 h-4" />
                        <span>{provider.distance.toFixed(1)} km</span>
                      </div>
                    )}
                    {provider.rating && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{provider.rating.toFixed(1)}</span>
                        <span>⭐</span>
                      </div>
                    )}
                  </div>
                </div>
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

