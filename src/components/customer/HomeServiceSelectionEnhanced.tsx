import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { MapPin, Clock, User, Star, ChevronRight, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ServiceProvider {
  providerId: string;
  name: string;
  rating: number;
  distance: number; // km
  commuteTime: number; // minutes
  photo?: string;
  services: string[];
  isPreviouslyUsed: boolean;
  availability: {
    morning: boolean; // 8-12
    evening: boolean; // 4-8
  };
}

interface HomeServiceSelectionEnhancedProps {
  serviceType: string;
  customerLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  onProviderSelect: (provider: ServiceProvider, timeWindow: 'morning' | 'evening') => void;
}

export function HomeServiceSelectionEnhanced({
  serviceType,
  customerLocation,
  onProviderSelect
}: HomeServiceSelectionEnhancedProps) {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [previousProviders, setPreviousProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<'morning' | 'evening' | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'radar'>('list');

  useEffect(() => {
    fetchProviders();
  }, [serviceType, customerLocation]);

  const fetchProviders = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/home-services/providers/nearby`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            serviceType,
            location: customerLocation,
            includeCommuteTime: true
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Separate previous and new providers
        const previous = data.providers?.filter((p: ServiceProvider) => p.isPreviouslyUsed) || [];
        const all = data.providers || [];
        
        setPreviousProviders(previous);
        setProviders(all);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Failed to load service providers');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: ServiceProvider) => {
    if (!selectedTimeWindow) {
      toast.error('Please select a time window first');
      return;
    }

    onProviderSelect(provider, selectedTimeWindow);
  };

  const getDirections = (provider: ServiceProvider) => {
    // Open Google Maps with directions
    const url = `https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby service providers...</p>
        </div>
      </div>
    );
  }

  const renderProviderCard = (provider: ServiceProvider) => (
    <div
      key={provider.providerId}
      className="bg-white rounded-xl border-2 border-gray-200 hover:border-orange-500 p-4 cursor-pointer transition-all"
      onClick={() => handleProviderSelect(provider)}
    >
      <div className="flex items-start gap-4">
        {/* Provider Photo */}
        <div className="w-16 h-16 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden">
          {provider.photo ? (
            <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Provider Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">{provider.name}</h3>
              {provider.isPreviouslyUsed && (
                <span className="text-xs text-green-600 font-medium">Previously Used</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="font-medium text-gray-900">{provider.rating}</span>
            </div>
          </div>

          {/* Distance & Commute Time */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{provider.distance.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{provider.commuteTime} min away</span>
            </div>
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">Available:</span>
            {provider.availability.morning && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                Morning (8-12)
              </span>
            )}
            {provider.availability.evening && (
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                Evening (4-8)
              </span>
            )}
          </div>

          {/* Services */}
          <div className="flex flex-wrap gap-2">
            {provider.services.slice(0, 3).map((service, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {service}
              </span>
            ))}
            {provider.services.length > 3 && (
              <span className="text-xs px-2 py-1 text-gray-500">
                +{provider.services.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              getDirections(provider);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Get Directions"
          >
            <Navigation className="w-5 h-5 text-gray-600" />
          </button>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Time Window Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Select Time Window</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedTimeWindow('morning')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedTimeWindow === 'morning'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="font-medium text-gray-900">Morning Slot</p>
              <p className="text-sm text-gray-600">8:00 AM - 12:00 PM</p>
            </div>
          </button>

          <button
            onClick={() => setSelectedTimeWindow('evening')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedTimeWindow === 'evening'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="font-medium text-gray-900">Evening Slot</p>
              <p className="text-sm text-gray-600">4:00 PM - 8:00 PM</p>
            </div>
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Select Service Provider</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'list'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('radar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'radar'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Radar View
          </button>
        </div>
      </div>

      {/* Previously Used Providers - Horizontal Scroll */}
      {previousProviders.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-green-600" />
            Previously Used Providers
          </h4>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {previousProviders.map(provider => (
              <div
                key={provider.providerId}
                className="flex-shrink-0 w-64 bg-green-50 border-2 border-green-200 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleProviderSelect(provider)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                    {provider.photo ? (
                      <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{provider.name}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-sm text-gray-600">{provider.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{provider.distance.toFixed(1)} km</span>
                  <span>{provider.commuteTime} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider List */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {providers
            .filter(p => !selectedTimeWindow || 
              (selectedTimeWindow === 'morning' && p.availability.morning) ||
              (selectedTimeWindow === 'evening' && p.availability.evening)
            )
            .map(renderProviderCard)}

          {providers.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              No service providers found in your area
            </div>
          )}
        </div>
      ) : (
        /* Radar View */
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Radar View</p>
              <p className="text-sm text-gray-500">
                Showing {providers.length} providers within {Math.max(...providers.map(p => p.distance)).toFixed(1)} km
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 max-w-xs mx-auto">
                {providers.slice(0, 4).map(provider => (
                  <div
                    key={provider.providerId}
                    className="text-left p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-orange-500"
                    onClick={() => handleProviderSelect(provider)}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{provider.name}</p>
                    <p className="text-xs text-gray-600">{provider.distance.toFixed(1)} km away</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
