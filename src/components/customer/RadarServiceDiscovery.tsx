/**
 * RADAR-BASED SERVICE PROVIDER DISCOVERY
 * Production-Grade Component
 * 
 * Features:
 * - Distance-based filtering
 * - Real-time availability
 * - Service provider cards with distance
 * - Quick booking
 */

import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { MapPin, Clock, Star, Navigation } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ServiceProvider {
  staffId: string;
  staffName: string;
  vendorId: string;
  vendorName: string;
  roleId: string;
  distance: number;
  estimatedTravelTime: number;
  available: boolean;
  nextAvailableSlot?: string;
  services: any[];
  rating?: number;
  photo?: string;
}

interface RadarServiceDiscoveryProps {
  roleId: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  customerLocation: { lat: number; lng: number };
  serviceId?: string;
  problemId?: string;
  date?: string;
  serviceDuration?: number;
  onProviderSelect: (provider: ServiceProvider) => void;
}

export function RadarServiceDiscovery({
  roleId,
  serviceStyle,
  customerLocation,
  serviceId,
  problemId,
  date,
  serviceDuration = 60,
  onProviderSelect
}: RadarServiceDiscoveryProps) {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadProviders();
  }, [roleId, serviceStyle, customerLocation, serviceId, problemId, date]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId,
        serviceStyle,
        customerLat: customerLocation.lat.toString(),
        customerLng: customerLocation.lng.toString(),
        serviceDuration: serviceDuration.toString()
      });

      if (serviceId) params.append('serviceId', serviceId);
      if (problemId) params.append('problemId', problemId);
      if (date) params.append('date', date);

      const response = await fetch(
        `${API_BASE}/customer/discover-staff-by-radar?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProviders(data.providers || []);
        }
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      toast.error('Failed to load service providers');
    } finally {
      setLoading(false);
    }
  };

  const sortedProviders = [...providers].sort((a, b) => {
    if (sortBy === 'distance') {
      return a.distance - b.distance;
    } else {
      return (b.rating || 0) - (a.rating || 0);
    }
  });

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
        <p className="mt-4 text-sm text-gray-600">Finding nearby providers...</p>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="py-8 text-center">
        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No service providers found in your area</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your location or service preferences</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Options */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {providers.length} Provider{providers.length !== 1 ? 's' : ''} Found
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('distance')}
            className={`px-3 py-1 text-xs rounded-lg ${
              sortBy === 'distance'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Distance
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1 text-xs rounded-lg ${
              sortBy === 'rating'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Rating
          </button>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-3">
        {sortedProviders.map((provider) => (
          <Card
            key={provider.staffId}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onProviderSelect(provider)}
          >
            <div className="flex items-start gap-3">
              {/* Photo */}
              <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {provider.photo ? (
                  <img src={provider.photo} alt={provider.staffName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{provider.staffName.charAt(0)}</span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{provider.staffName}</div>
                <div className="text-xs text-gray-500">{provider.vendorName}</div>

                <div className="flex items-center gap-3 mt-2">
                  {serviceStyle === 'at_home' && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span>{provider.distance.toFixed(1)} km</span>
                    </div>
                  )}
                  {provider.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-gray-600">{provider.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {serviceStyle === 'at_home' && provider.estimatedTravelTime > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>~{provider.estimatedTravelTime} min</span>
                    </div>
                  )}
                </div>

                {/* Availability */}
                <div className="mt-2">
                  {provider.available ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {provider.nextAvailableSlot ? `Next: ${provider.nextAvailableSlot}` : 'Unavailable'}
                    </span>
                  )}
                </div>

                {/* Services Preview */}
                {provider.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {provider.services.slice(0, 2).map((service, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200"
                      >
                        {service.serviceName || service.name}
                      </span>
                    ))}
                    {provider.services.length > 2 && (
                      <span className="text-xs text-gray-500">+{provider.services.length - 2} more</span>
                    )}
                  </div>
                )}
              </div>

              {/* Select Button */}
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onProviderSelect(provider);
                }}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              >
                Select
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

