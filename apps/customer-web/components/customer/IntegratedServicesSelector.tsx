'use client';

import React, { useState, useEffect } from 'react';
import { Ambulance, Microscope, Pill, MapPin, Clock, Star, Navigation, AlertCircle, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ServiceProvider {
  id: string;
  providerId: string;
  providerName: string;
  isClinicAttached: boolean;
  distance: number;
  eta: number;
  basePrice: number;
  rating?: number;
  vehicleType?: string;
  testsAvailable?: string[];
}

interface IntegratedServicesSelectorProps {
  customerId: string;
  bookingId?: string;
  initialType?: 'ambulance' | 'diagnostic' | 'pharmacy';
  onServiceSelected: (request: any) => void;
  onClose: () => void;
}

export function IntegratedServicesSelector({
  customerId,
  bookingId,
  initialType = 'ambulance',
  onServiceSelected,
  onClose
}: IntegratedServicesSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>(initialType);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [userLocation, setUserLocation] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error(err)
      );
    }
  }, []);

  useEffect(() => {
    if (userLocation.lat !== 0) {
      loadServices(activeTab);
    }
  }, [activeTab, userLocation, bookingId]);

  const loadServices = async (type: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        type: type,
        bookingId: bookingId || ''
      });

      const response = await apiClient.get<{ services: ServiceProvider[] }>(
        `/integrated-services/available?${params}`
      );
      
      if (response.services) {
        setProviders(response.services);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      const response = await apiClient.post<{ request: any }>(
        '/integrated-services/request',
        {
          customerId,
          providerId: selectedProvider.providerId,
          serviceType: activeTab,
          bookingId,
          location: { ...userLocation, address: 'Current Location' },
          details: {
            providerName: selectedProvider.providerName,
            price: selectedProvider.basePrice
          }
        }
      );

      if (response.request) {
        onServiceSelected(response.request);
        onClose();
      }
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProviderCard = (provider: ServiceProvider) => (
    <div
      key={provider.id || provider.providerId}
      onClick={() => setSelectedProvider(provider)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        selectedProvider?.id === provider.id
          ? 'border-primary bg-orange-50'
          : 'border-gray-100 bg-white hover:border-primary'
      }`}
    >
      <div className="flex justify-between items-start mb-0">
        <div>
          <h3 className="font-semibold text-gray-900">{provider.providerName}</h3>
          {provider.isClinicAttached ? (
            <span className="px-0 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              Clinic Attached
            </span>
          ) : (
            <span className="px-0 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
              Independent
            </span>
          )}
        </div>
        {provider.rating && (
          <div className="flex items-center gap-0">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold">{provider.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 mt-0">
        <div className="flex items-center gap-0">
          <MapPin className="w-4 h-4" />
          <span>{provider.distance.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-0">
          <Clock className="w-4 h-4" />
          <span>ETA: {provider.eta} min</span>
        </div>
        <div className="font-semibold text-primary ml-auto">
          ₹{provider.basePrice}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-primary-dark px-0 py-0 flex items-center justify-between z-10">
          <h2 className="text-white font-bold text-lg">Select Service</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-0 py-4 border-b border-gray-200">
          <div className="flex gap-0">
            {[
              { id: 'ambulance', label: 'Ambulance', icon: Ambulance },
              { id: 'diagnostic', label: 'Diagnostic', icon: Microscope },
              { id: 'pharmacy', label: 'Pharmacy', icon: Pill }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-0 rounded-xl font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-0">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Providers List */}
        <div className="px-0 py-0">
          {loading ? (
            <div className="flex items-center justify-center py-02">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No providers available</p>
            </div>
          ) : (
            <div className="space-y-3 mb-0">
              {providers.map((provider) => renderProviderCard(provider))}
            </div>
          )}

          {/* Request Button */}
          {selectedProvider && (
            <button
              onClick={handleRequest}
              disabled={loading}
              className="w-full py-1 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Requesting...' : `Request ${activeTab === 'ambulance' ? 'Ambulance' : activeTab === 'diagnostic' ? 'Diagnostic' : 'Pharmacy'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

