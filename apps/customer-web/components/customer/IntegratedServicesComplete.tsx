'use client';

import React, { useState, useEffect } from 'react';
import {
  Ambulance,
  Pill,
  Activity,
  MapPin,
  Star,
  Clock,
  Phone,
  ChevronRight,
  Filter,
  Building,
  User,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

interface ServiceProvider {
  providerId: string;
  providerName: string;
  providerType: 'clinic' | 'independent';
  serviceType: 'ambulance' | 'pharmacy' | 'diagnostics';
  parentClinicId?: string;
  location: { lat: number; lng: number; address: string };
  isAvailable: boolean;
  rating: number;
  distance?: number;
}

interface IntegratedServicesCompleteProps {
  customerId: string;
  onBack?: () => void;
  selectedService?: 'ambulance' | 'pharmacy' | 'diagnostics';
}

const SERVICE_CONFIG = {
  ambulance: {
    icon: Ambulance,
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    title: 'Emergency Ambulance',
    description: 'Quick response for medical emergencies'
  },
  pharmacy: {
    icon: Pill,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    title: 'Medicine Delivery',
    description: 'Get medicines delivered to your doorstep'
  },
  diagnostics: {
    icon: Activity,
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-500',
    title: 'Diagnostic Services',
    description: 'Book lab tests and health checkups'
  }
};

export function IntegratedServicesComplete({
  customerId,
  onBack,
  selectedService
}: IntegratedServicesCompleteProps) {
  const [currentView, setCurrentView] = useState<'selector' | 'providers'>('selector');
  const [activeService, setActiveService] = useState<'ambulance' | 'pharmacy' | 'diagnostics' | null>(
    selectedService || null
  );
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'clinic' | 'independent'>('all');

  useEffect(() => {
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe((coords: { lat: number; lng: number }) => setUserLocation(coords));
  }, []);

  useEffect(() => {
    if (activeService) {
      fetchProviders(activeService);
    }
  }, [activeService, userLocation]);

  const fetchProviders = async (serviceType: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        serviceType
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('radius', '15'); // 15km radius
      }

      const data = await apiClient.get<{ data?: { providers?: ServiceProvider[] }, providers?: ServiceProvider[] }>(`/customer/integrated-services/providers?${params.toString()}`);
      setProviders(data.data?.providers || data.providers || []);
      setCurrentView('providers');
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: 'ambulance' | 'pharmacy' | 'diagnostics') => {
    setActiveService(service);
  };

  const handleBack = () => {
    if (currentView === 'providers') {
      setCurrentView('selector');
      setActiveService(null);
    } else if (onBack) {
      onBack();
    }
  };

  const handleProviderSelect = async (provider: ServiceProvider) => {
    // Check availability before proceeding
    try {
      const data = await apiClient.get<{ data?: { availability?: { isAvailable: boolean, reason?: string } } }>(`/customer/providers/${provider.providerId}/availability`);
      if (data.data?.availability?.isAvailable) {
        // Proceed with booking
        console.log('Provider available, proceeding to booking:', provider);
        // TODO: Navigate to booking flow
      } else {
        alert(`Service not available: ${data.data?.availability?.reason || 'Service unavailable'}`);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      alert('Unable to check availability. Please try again.');
    }
  };

  const filteredProviders = providers.filter((p) => {
    if (filterType === 'all') return true;
    return p.providerType === filterType;
  });

  // Service Selector View
  if (currentView === 'selector') {
    return (
      <div className="min-h-screen bg-white pb-24">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div>
              <h1 className="text-white">Integrated Services</h1>
              <p className="text-white/90 text-sm">Medical services at your fingertips</p>
            </div>
          </div>
        </div>

        {/* Service Cards */}
        <div className="px-6 py-6 space-y-4">
          {(Object.keys(SERVICE_CONFIG) as Array<keyof typeof SERVICE_CONFIG>).map((serviceKey) => {
            const config = SERVICE_CONFIG[serviceKey];
            const IconComponent = config.icon;

            return (
              <Card
                key={serviceKey}
                className={`cursor-pointer hover:shadow-lg transition-all border-2 ${config.borderColor}`}
                onClick={() => handleServiceSelect(serviceKey)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                      <IconComponent className={`w-8 h-8 ${config.textColor}`} />
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <h3 className={`${config.textColor} mb-1`}>{config.title}</h3>
                      <p className="text-sm text-gray-600">{config.description}</p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          Clinic-based
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Independent
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className={`w-6 h-6 ${config.textColor}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="px-6 py-4 bg-gray-50 mx-6 rounded-xl">
          <h3 className="text-gray-900 text-sm mb-2">Why Choose Integrated Services?</h3>
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Quick response times for emergencies</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Verified vendors with proper licenses</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Real-time tracking and updates</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>24/7 availability for critical services</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Providers List View
  const serviceConfig = activeService ? SERVICE_CONFIG[activeService] : null;
  if (!serviceConfig) return null;

  const IconComponent = serviceConfig.icon;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className={`bg-gradient-to-r from-${serviceConfig.color}-500 to-${serviceConfig.color}-600 px-6 py-6`}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <IconComponent className="w-6 h-6 text-white" />
              <h1 className="text-white">{serviceConfig.title}</h1>
            </div>
            <p className="text-white/90 text-sm">{filteredProviders.length} providers available</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'clinic', label: 'Clinic-Based' },
            { value: 'independent', label: 'Independent' }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value as any)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                filterType === filter.value
                  ? 'bg-white text-gray-900'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-12 text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Finding available providers...</p>
        </div>
      )}

      {/* Providers List */}
      {!loading && (
        <div className="px-6 py-6 space-y-4">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.providerId}
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => handleProviderSelect(provider)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Provider Icon */}
                  <div className={`w-16 h-16 rounded-lg ${serviceConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                    {provider.providerType === 'clinic' ? (
                      <Building className={`w-8 h-8 ${serviceConfig.textColor}`} />
                    ) : (
                      <User className={`w-8 h-8 ${serviceConfig.textColor}`} />
                    )}
                  </div>

                  {/* Provider Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h3 className="text-gray-900 line-clamp-1 mb-1">{provider.providerName}</h3>
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize ${
                            provider.providerType === 'clinic' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {provider.providerType}
                        </Badge>
                      </div>
                      {provider.isAvailable ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Unavailable
                        </Badge>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{provider.location.address}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      {provider.rating > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <Star className="w-4 h-4 fill-current" />
                          {Number(provider.rating || 0).toFixed(1)}
                        </span>
                      )}
                      
                      {provider.distance !== undefined && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-4 h-4" />
                          {Number(provider.distance || 0).toFixed(1)} km
                        </span>
                      )}

                      {provider.isAvailable && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Clock className="w-4 h-4" />
                          Open now
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 self-center" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProviders.length === 0 && (
        <div className="px-6 py-12 text-center">
          <div className={`w-16 h-16 ${serviceConfig.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <AlertCircle className={`w-8 h-8 ${serviceConfig.textColor}`} />
          </div>
          <h3 className="text-gray-900 mb-2">No providers found</h3>
          <p className="text-sm text-gray-500 mb-4">
            There are no {serviceConfig.title.toLowerCase()} providers available in your area right now.
          </p>
          <Button
            variant="outline"
            onClick={handleBack}
            className="border-orange-500 text-orange-500 hover:bg-orange-50"
          >
            Try Another Service
          </Button>
        </div>
      )}
    </div>
  );
}
