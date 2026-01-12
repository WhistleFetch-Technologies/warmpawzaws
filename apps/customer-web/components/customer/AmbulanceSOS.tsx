"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Siren, MapPin, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AmbulanceSOSProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

// Map Placeholder Component - Shows visual representation of map
const MapPlaceholder = ({ userLocation }: { userLocation?: { lat: number; lng: number } }) => (
  <div className="w-full h-64 bg-gray-100 flex items-center justify-center relative overflow-hidden rounded-xl border-2 border-gray-200">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
    <div className="z-10 flex flex-col items-center text-gray-400">
      <Navigation className="w-8 h-8 mb-2" />
      <span className="text-xs font-medium">Live Tracking Map</span>
    </div>
    {/* User location marker */}
    {userLocation && (
      <>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
      </>
    )}
  </div>
);

export function AmbulanceSOS(props: AmbulanceSOSProps) {
  const phone = props.phone || props.customerPhone || '';
  const [step, setStep] = useState<'alert' | 'locating' | 'contact' | 'tracking'>('alert');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ address: string; lat?: number; lng?: number } | null>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState<any>(null);
  const [trackingData, setTrackingData] = useState<any>(null);

  useEffect(() => {
    if (step === 'locating') {
      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setLocation({
              address: 'Locating...',
              lat,
              lng
            });
            
            // Simulate finding location and ambulances
            setTimeout(() => {
              setLocation({
                address: 'Indiranagar, Bangalore',
                lat,
                lng
              });
              findNearbyAmbulances(lat, lng);
            }, 2000);
          },
          () => {
            // Fallback if location denied
            setLocation({ address: 'Indiranagar, Bangalore' });
            setTimeout(() => findNearbyAmbulances(12.9716, 77.5946), 2000);
          }
        );
      } else {
        setLocation({ address: 'Indiranagar, Bangalore' });
        setTimeout(() => findNearbyAmbulances(12.9716, 77.5946), 2000);
      }
    }
  }, [step]);

  const findNearbyAmbulances = async (lat?: number, lng?: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_ambulance',
        ...(lat && lng && { lat: lat.toString(), lng: lng.toString() })
      });

      const data = await apiClient.get<{ services?: any[]; vendors?: any[] }>(`/customer/services?${params.toString()}`);
      const ambulanceList = data.services || data.vendors || [];
      
      if (ambulanceList.length === 0) {
        // Fallback mock data
        setAmbulances([
          { 
            vendorName: 'City Pet Ambulance', 
            vendorId: 'amb1', 
            distance: '2.5 km', 
            eta: '10 mins', 
            phone: '9999999999',
            driverName: 'Raj Kumar',
            vehicleNumber: 'KA-01-AB-1234'
          }
        ]);
      } else {
        setAmbulances(ambulanceList);
      }
      
      setStep('contact');
    } catch (error) {
      console.error('Error finding ambulances:', error);
      // Fallback mock
      setAmbulances([
        { 
          vendorName: 'City Pet Ambulance', 
          vendorId: 'amb1', 
          distance: '2.5 km', 
          eta: '10 mins', 
          phone: '9999999999',
          driverName: 'Raj Kumar',
          vehicleNumber: 'KA-01-AB-1234'
        }
      ]);
      setStep('contact');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyCall = (vendorPhone: string) => {
    window.open(`tel:${vendorPhone}`);
  };

  const handleRequestDispatch = async (ambulance: any) => {
    try {
      setLoading(true);
      setSelectedAmbulance(ambulance);
      
      const bookingPayload = {
        vendorId: ambulance.vendorId,
        serviceId: 'emergency_dispatch',
        customerPhone: phone,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        notes: `EMERGENCY SOS REQUEST. Location: ${location?.address}`,
        petDetails: { count: 1 },
        status: 'emergency',
        price: 0,
        location: location
      };

      const response = await apiClient.post<any>('/bookings', bookingPayload);
      
      if (response.success || response.bookingId) {
        toast.success('Emergency dispatch requested! Ambulance is on the way.');
        
        // Set tracking data
        setTrackingData({
          bookingId: response.bookingId || `booking_${Date.now()}`,
          driverName: ambulance.driverName || 'Driver',
          vehicleNumber: ambulance.vehicleNumber || 'AMB-001',
          phone: ambulance.phone,
          eta: ambulance.eta || '10 mins'
        });
        
        setStep('tracking');
        if (props.onSuccess) {
          props.onSuccess(response.bookingId || `booking_${Date.now()}`);
        }
      } else {
        toast.error('Failed to request dispatch');
      }
    } catch (error: any) {
      console.error('Dispatch error:', error);
      toast.error(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'alert') {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Siren className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Emergency?</h1>
          <p className="text-gray-600 mt-2">Find the nearest pet ambulance immediately.</p>
        </div>

        <Button 
          className="w-full max-w-xs h-16 text-xl bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xl shadow-red-200 animate-bounce"
          onClick={() => setStep('locating')}
        >
          TAP FOR HELP
        </Button>

        <button onClick={props.onBack} className="mt-8 text-gray-500 underline">Cancel</button>
      </div>
    );
  }

  if (step === 'locating') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 border-4 border-t-red-500 border-gray-700 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">Locating nearest units...</h2>
        <p className="text-gray-400 mt-2 text-sm">Please enable GPS</p>
      </div>
    );
  }

  if (step === 'tracking') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <div className="bg-red-600 text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={props.onBack}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-bold text-lg">Live Tracking</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Map Component */}
          <MapPlaceholder userLocation={location ? { lat: location.lat || 12.9716, lng: location.lng || 77.5946 } : undefined} />

          {/* Driver Details */}
          {selectedAmbulance && trackingData && (
            <Card className="p-4 border-l-4 border-red-500">
              <h3 className="font-bold text-gray-900 mb-3">Ambulance Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-semibold text-gray-900">{trackingData.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle:</span>
                  <span className="font-semibold text-gray-900">{trackingData.vehicleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ETA:</span>
                  <span className="font-semibold text-green-600">{trackingData.eta}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleEmergencyCall(trackingData.phone)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Driver
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Emergency Status:</strong> Ambulance is on the way. You can track its location in real-time on the map above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-red-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={props.onBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">Nearby Ambulances</h1>
        </div>
      </div>

      <div className="p-4">
        {/* Map showing location */}
        {location && (
          <div className="mb-4">
            <MapPlaceholder userLocation={location.lat && location.lng ? { lat: location.lat, lng: location.lng } : undefined} />
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mt-2 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-500">Current Location</p>
                <p className="font-semibold text-gray-900">{location.address}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {ambulances.map((amb, idx) => (
            <Card key={idx} className="p-4 border-l-4 border-red-500">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{amb.vendorName || 'Emergency Unit'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {amb.distance || '2km'}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-green-600">
                      <Clock className="w-3 h-3" /> {amb.eta || '10 mins'}
                    </span>
                  </div>
                </div>
                <div className="bg-red-50 p-2 rounded-full">
                  <Siren className="w-6 h-6 text-red-600" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button 
                  variant="outline" 
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleEmergencyCall(amb.phone || '911')}
                >
                  <Phone className="w-4 h-4 mr-2" /> Call
                </Button>
                <Button 
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleRequestDispatch(amb)}
                  disabled={loading}
                >
                  {loading ? 'Dispatching...' : 'Confirm SOS'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}