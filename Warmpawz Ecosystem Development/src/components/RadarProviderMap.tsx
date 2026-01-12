import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Star, Phone } from 'lucide-react';

/**
 * 📍 RADAR PROVIDER MAP
 * 
 * Phase 7C: Rule 2 - Home Services Enhancement
 * 
 * Features:
 * - Interactive map with provider locations
 * - Distance circles (1km, 3km, 5km)
 * - Real-time provider availability
 * - Commute time estimates
 */

interface RadarProvider {
  providerId: string;
  providerName: string;
  location: { lat: number; lng: number; address: string };
  distance: number;
  commuteTime: number;
  isAvailable: boolean;
  services: string[];
  rating: number;
}

interface RadarProviderMapProps {
  userLocation: { lat: number; lng: number };
  radius?: number;
  serviceType?: string;
  onSelectProvider?: (provider: RadarProvider) => void;
  apiUrl?: string;
}

export function RadarProviderMap({
  userLocation,
  radius = 5,
  serviceType,
  onSelectProvider,
  apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475`,
}: RadarProviderMapProps) {
  const [providers, setProviders] = useState<RadarProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRadius, setSelectedRadius] = useState(radius);
  const [selectedProvider, setSelectedProvider] = useState<RadarProvider | null>(null);

  useEffect(() => {
    loadProviders();
  }, [userLocation, selectedRadius, serviceType]);

  const loadProviders = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: selectedRadius.toString(),
      });

      if (serviceType) {
        params.append('serviceType', serviceType);
      }

      const response = await fetch(`${apiUrl}/home-services/providers/radar?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to load providers');
      }

      const data = await response.json();
      setProviders(data.data?.providers || []);
    } catch (err) {
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderClick = (provider: RadarProvider) => {
    setSelectedProvider(provider);
    onSelectProvider?.(provider);
  };

  const radiusOptions = [1, 3, 5, 10];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2">
          <Navigation className="w-6 h-6 text-blue-600" />
          <span>Nearby Providers</span>
        </h2>
        <div className="flex gap-2">
          {radiusOptions.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRadius(r)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedRadius === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r}km
            </button>
          ))}
        </div>
      </div>

      {/* Map Visualization */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '400px' }}>
        {/* Simplified visual representation */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Radius circles */}
          <div className="absolute">
            {[selectedRadius / 3, (selectedRadius * 2) / 3, selectedRadius].map((r, i) => (
              <div
                key={i}
                className="absolute rounded-full border-2 border-blue-300 border-opacity-30"
                style={{
                  width: `${(r / selectedRadius) * 300}px`,
                  height: `${(r / selectedRadius) * 300}px`,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </div>

          {/* User location */}
          <div className="absolute bg-blue-600 rounded-full p-2 shadow-lg z-10">
            <MapPin className="w-5 h-5 text-white" />
          </div>

          {/* Provider markers (simplified) */}
          {!loading &&
            providers.slice(0, 8).map((provider, index) => {
              const angle = (index / 8) * 2 * Math.PI;
              const distance = (provider.distance / selectedRadius) * 120;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;

              return (
                <button
                  key={provider.providerId}
                  onClick={() => handleProviderClick(provider)}
                  className={`absolute p-2 rounded-full shadow-lg transition-all hover:scale-110 ${
                    provider.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                  } ${
                    selectedProvider?.providerId === provider.providerId
                      ? 'ring-4 ring-blue-500'
                      : ''
                  }`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  title={provider.providerName}
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                </button>
              );
            })}
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Provider List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{providers.length} providers within {selectedRadius}km</span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" /> Available
            <span className="w-3 h-3 bg-gray-400 rounded-full ml-2" /> Busy
          </span>
        </div>

        <div className="grid gap-2 max-h-[300px] overflow-y-auto">
          {providers.map(provider => (
            <button
              key={provider.providerId}
              onClick={() => handleProviderClick(provider)}
              className={`p-4 bg-white border rounded-lg text-left hover:border-blue-500 transition-all ${
                selectedProvider?.providerId === provider.providerId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base">{provider.providerName}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        provider.isAvailable
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {provider.isAvailable ? 'Available' : 'Busy'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {provider.distance.toFixed(1)}km away
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ~{provider.commuteTime} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                      {provider.rating.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {provider.services.slice(0, 3).map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-gray-100 text-xs rounded"
                      >
                        {service}
                      </span>
                    ))}
                    {provider.services.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-gray-500">
                        +{provider.services.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <Phone className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {providers.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-600">
          No providers found within {selectedRadius}km radius.
          <br />
          Try increasing the search radius.
        </div>
      )}
    </div>
  );
}
