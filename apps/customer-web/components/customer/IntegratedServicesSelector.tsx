'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Ambulance, Microscope, Pill, MapPin, Clock, Star, Navigation, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
// Uses apiClient (API Gateway)
import { motion, AnimatePresence } from 'framer-motion';
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
  vehicleType?: string; // for ambulance
  testsAvailable?: string[]; // for diagnostics
}

interface IntegratedServicesSelectorProps {
  customerId: string;
  bookingId?: string; // Optional: if tied to an existing vet booking
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
    // Get location mock
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err)
    );
  }, []);

  useEffect(() => {
    if (userLocation.lat !== 0) {
      loadServices(activeTab);
    }
  }, [activeTab, userLocation, bookingId]);

  const loadServices = async (type: string) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        type: type,
        bookingId: bookingId || ''
      });

      const data = await apiClient.get<{ services?: ServiceProvider[] }>(`/customer/services/integrated?${query.toString()}`);
      setProviders(data.services || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      const data = await apiClient.post('/bookings/create', {
        customerId,
        vendorId: selectedProvider.providerId,
        serviceType: activeTab,
        parentBookingId: bookingId,
        serviceLocation: { ...userLocation, address: 'Current Location' },
        notes: `${activeTab} service request - ${selectedProvider.providerName}`,
        amount: selectedProvider.basePrice
      });
      toast.success(`${activeTab === 'ambulance' ? 'Ambulance' : 'Service'} requested successfully!`);
      onServiceSelected(data);
      onClose();
    } catch (error) {
      toast.error('Failed to request service');
    } finally {
      setLoading(false);
    }
  };

  const renderProviderCard = (provider: ServiceProvider) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={provider.id || provider.providerId}
      onClick={() => setSelectedProvider(provider)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        selectedProvider?.id === provider.id
          ? 'border-orange-500 bg-orange-50'
          : 'border-gray-100 bg-white hover:border-orange-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{provider.providerName}</h3>
          {provider.isClinicAttached ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              Clinic Attached
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
              Independent
            </Badge>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-gray-900">
            {provider.basePrice === 0 ? 'Free' : `₹${provider.basePrice}`}
          </p>
          <p className="text-xs text-gray-500">base fare</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-orange-500" />
          <span className="font-medium">{provider.eta} min</span>
        </div>
        <div className="flex items-center gap-1">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span>{Number(provider.distance || 0).toFixed(1)} km</span>
        </div>
        {provider.rating && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span>{provider.rating}</span>
          </div>
        )}
      </div>

      {provider.vehicleType && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Ambulance className="w-3 h-3" />
            Vehicle: <span className="font-medium text-gray-700">{provider.vehicleType}</span>
          </p>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="bg-gray-50 h-full flex flex-col">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm z-10">
        <h2 className="text-lg font-bold text-gray-900">Integrated Services</h2>
        <p className="text-sm text-gray-500">Select additional services for your pet</p>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="ambulance" className="flex items-center gap-2">
              <Ambulance className="w-4 h-4" />
              <span className="hidden sm:inline">Ambulance</span>
            </TabsTrigger>
            <TabsTrigger value="diagnostic" className="flex items-center gap-2">
              <Microscope className="w-4 h-4" />
              <span className="hidden sm:inline">Diagnostics</span>
            </TabsTrigger>
            <TabsTrigger value="pharmacy" className="flex items-center gap-2">
              <Pill className="w-4 h-4" />
              <span className="hidden sm:inline">Pharmacy</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Finding nearby providers...</div>
        ) : providers.length > 0 ? (
          <>
             {bookingId && providers.some(p => p.isClinicAttached) && (
                <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Recommended (Your Clinic)</h3>
                    <div className="space-y-3">
                        {providers.filter(p => p.isClinicAttached).map(renderProviderCard)}
                    </div>
                </div>
             )}
             
             <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
                    {bookingId ? 'Other Nearby Options' : 'Nearby Options'}
                </h3>
                <div className="space-y-3">
                    {providers.filter(p => !p.isClinicAttached).map(renderProviderCard)}
                </div>
             </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">No providers found</h3>
            <p className="text-sm text-gray-500 mt-1">Try changing your location or check back later.</p>
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 bg-white border-t border-gray-200">
        <Button 
          className="w-full py-6 text-lg bg-orange-600 hover:bg-orange-700"
          disabled={!selectedProvider || loading}
          onClick={handleRequest}
        >
          {loading ? 'Processing...' : `Request ${activeTab === 'ambulance' ? 'Ambulance' : 'Service'}`}
        </Button>
      </div>
    </div>
  );
}
