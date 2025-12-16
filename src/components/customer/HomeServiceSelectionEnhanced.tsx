import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { MapPin, Clock, Star, Calendar, ChevronRight, Heart, TrendingUp, Navigation, User, Radar, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { RadarProviderMap } from '../RadarProviderMap';
import { PreviousProvidersCarousel } from '../PreviousProvidersCarousel';

// Types
interface Provider {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviews: number;
  distance: number;
  commuteTime: number;
  price: number;
  previouslyUsed: boolean;
  isAvailable: boolean;
  nextAvailableSlot?: string;
  specialization?: string;
  coordinates: { lat: number; lng: number };
}

interface TimeWindow {
  id: string;
  label: string;
  time: string;
  icon: 'morning' | 'afternoon' | 'evening';
  isPackageEligible: boolean;
}

interface HomeServiceSelectionEnhancedProps {
  serviceType: string;
  serviceName: string;
  customerId: string;
  petId: string;
  isSubscription?: boolean;
  onBack: () => void;
  onBookingComplete: (bookingId: string) => void;
}

export function HomeServiceSelectionEnhanced({
  serviceType,
  serviceName,
  customerId,
  petId,
  isSubscription = false,
  onBack,
  onBookingComplete
}: HomeServiceSelectionEnhancedProps) {
  const [step, setStep] = useState<'timeWindow' | 'providers' | 'schedule'>('timeWindow');
  const [viewMode, setViewMode] = useState<'list' | 'radar'>('list');
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string>('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 28.6139, lng: 77.2090 }); // Default Delhi

  const timeWindows: TimeWindow[] = [
    { id: 'morning', label: 'Morning', time: '8:00 AM - 12:00 PM', icon: 'morning', isPackageEligible: true },
    { id: 'afternoon', label: 'Afternoon', time: '12:00 PM - 4:00 PM', icon: 'afternoon', isPackageEligible: false },
    { id: 'evening', label: 'Evening', time: '4:00 PM - 8:00 PM', icon: 'evening', isPackageEligible: true }
  ];

  useEffect(() => {
    // Simulate getting user location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error("Error getting location", error);
      }
    );
  }, [customerId, serviceType]);

  useEffect(() => {
    if (selectedTimeWindow) {
      loadProviders();
    }
  }, [selectedTimeWindow]);

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);

      // Search for providers based on service type and time window using Radar endpoint for comprehensive data
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/home-services/providers/radar?serviceType=${serviceType}&lat=${userLocation.lat}&lng=${userLocation.lng}&radius=15`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const vendorList = data.providers || [];

        const transformedProviders: Provider[] = await Promise.all(vendorList.map(async (v: any) => {
            // Calculate commute time for each provider
            // In a real optimized scenario, we would batch this or the radar endpoint would return it
            // For now, we simulate or use the simple calc if not provided
            
            let commuteTime = 30; // default
            try {
                 const commuteRes = await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/home-services/calculate-commute-time`,
                    {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${publicAnonKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            providerId: v.id,
                            customerLat: userLocation.lat,
                            customerLng: userLocation.lng
                        })
                    }
                );
                if (commuteRes.ok) {
                    const cData = await commuteRes.json();
                    commuteTime = cData.commute.estimatedTime;
                }
            } catch (e) { console.error(e); }

            return {
              id: v.id,
              name: v.name,
              photo: v.photo || '', // Add photo if available in radar response
              rating: v.rating || 4.5,
              reviews: v.reviewCount || 0,
              distance: parseFloat(v.distance),
              commuteTime: commuteTime,
              price: v.basePrice || 0,
              previouslyUsed: false, // Will be handled by PreviousProvidersCarousel logic separation
              isAvailable: v.available !== false,
              nextAvailableSlot: 'Today', // Placeholder or fetch real availability
              specialization: v.specialization,
              coordinates: v.location || { lat: 0, lng: 0 }
            };
        }));

        setProviders(transformedProviders);
        setStep('providers');
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      toast.error('Failed to load service providers');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleTimeWindowSelect = (windowId: string) => {
    setSelectedTimeWindow(windowId);
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setStep('schedule');
  };

  const handleBooking = async () => {
    if (!selectedDate && !isSubscription) {
      toast.error('Please select a date');
      return;
    }
    if (!selectedSlot && !isSubscription) {
        toast.error('Please select a time slot');
        return;
    }

    try {
      setLoading(true);

      const provider = providers.find(p => p.id === selectedProvider);
      
      const bookingData = {
        customerId,
        petId,
        vendorId: selectedProvider,
        vendorName: provider?.name,
        serviceType,
        serviceName,
        serviceStyle: 'at_home',
        scheduledDate: selectedDate,
        scheduledTime: isSubscription ? selectedTimeWindow : selectedSlot,
        timeWindow: selectedTimeWindow,
        address: {}, 
        totalAmount: provider?.price || 0,
        commuteTime: provider?.commuteTime || 0,
        distance: provider?.distance || 0,
        previouslyUsed: provider?.previouslyUsed || false,
        isSubscription: isSubscription
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(bookingData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(isSubscription ? 'Subscription activated!' : 'Booking created successfully!');
        onBookingComplete(data.booking.id);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Error creating booking');
    } finally {
      setLoading(false);
    }
  };

  // --- Render Components ---

  const TimeWindowStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isSubscription ? 'Select Daily Schedule Window' : 'Choose Your Preferred Time'}
        </h2>
        <p className="text-gray-600">
            {isSubscription 
                ? 'For subscription packages, choose a general time window for daily visits.' 
                : 'Select a time window that works best for you'}
        </p>
      </div>

      <div className="space-y-3">
        {timeWindows.map((window) => (
          <button
            key={window.id}
            onClick={() => handleTimeWindowSelect(window.id)}
            disabled={isSubscription && !window.isPackageEligible}
            className={`w-full p-4 rounded-xl border-2 transition-all relative ${
              selectedTimeWindow === window.id
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-orange-300'
            } ${isSubscription && !window.isPackageEligible ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                window.icon === 'morning' ? 'bg-yellow-100' :
                window.icon === 'afternoon' ? 'bg-orange-100' :
                'bg-purple-100'
              }`}>
                <Clock className={`w-6 h-6 ${
                     window.icon === 'morning' ? 'text-yellow-600' :
                     window.icon === 'afternoon' ? 'text-orange-600' :
                     'text-purple-600'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">{window.label}</p>
                <p className="text-sm text-gray-600">{window.time}</p>
                {isSubscription && !window.isPackageEligible && (
                    <span className="text-xs text-red-500">Not available for packages</span>
                )}
              </div>
              {selectedTimeWindow === window.id && (
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedTimeWindow && !loadingProviders && (
        <Button 
          onClick={() => loadProviders()}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          Find Service Providers
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );

  const ProvidersStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <button onClick={() => setStep('timeWindow')} className="text-gray-600">
                <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
            <h2 className="text-xl font-bold text-gray-900">Choose Provider</h2>
            <p className="text-sm text-gray-600">
                {timeWindows.find(w => w.id === selectedTimeWindow)?.time}
            </p>
            </div>
        </div>
        <div className="flex gap-2">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
                List
            </Button>
            <Button variant={viewMode === 'radar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('radar')}>
                <Radar className="w-4 h-4" />
            </Button>
        </div>
      </div>

      {/* Previous Providers - Replaced with Component */}
      {viewMode === 'list' && (
          <PreviousProvidersCarousel 
            customerId={customerId} 
            onBookProvider={(p) => handleProviderSelect(p.providerId)} 
          />
      )}

      {/* Main List or Radar */}
      {loadingProviders ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Scanning for nearby providers...</p>
          </div>
      ) : viewMode === 'radar' ? (
          <RadarProviderMap
            userLocation={userLocation}
            radius={15}
            serviceType={serviceType}
            onSelectProvider={(p) => handleProviderSelect(p.providerId)}
          />
      ) : (
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Available Nearby</h3>
                <span className="text-sm text-gray-600">{providers.length} providers</span>
             </div>
             {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedProvider === provider.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-300'
                } ${provider.previouslyUsed ? 'ring-2 ring-orange-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {provider.photo ? (
                      <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-orange-100">
                        <User className="w-6 h-6 text-orange-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{provider.name}</p>
                      {provider.previouslyUsed && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-orange-700" />
                          Trusted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{provider.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{provider.distance.toFixed(1)} km</span>
                      </div>
                      <div className="flex items-center gap-1 text-orange-600 font-medium">
                        <Clock className="w-4 h-4" />
                        <span>{provider.commuteTime} min away</span>
                      </div>
                    </div>
                    {provider.specialization && (
                      <p className="text-xs text-gray-500 mt-1">{provider.specialization}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-bold text-orange-600">₹{provider.price}</span>
                    {!provider.isAvailable && (
                        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">
                            Busy
                        </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
      )}
    </div>
  );

  const ScheduleStep = () => {
    const provider = providers.find(p => p.id === selectedProvider);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('providers')} className="text-gray-600">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
                {isSubscription ? 'Confirm Subscription' : 'Schedule Appointment'}
            </h2>
            <p className="text-sm text-gray-600">with {provider?.name}</p>
          </div>
        </div>

        {/* Provider Summary */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-full overflow-hidden bg-white">
              {provider?.photo ? (
                <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-orange-100">
                  <User className="w-6 h-6 text-orange-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{provider?.name}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Navigation className="w-3 h-3" />
                <span>{provider?.distance.toFixed(1)} km away</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>~{provider?.commuteTime} min travel time (w/ traffic)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
              {isSubscription ? 'Start Date' : 'Select Date'}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Time Slot Selection - Only for non-subscription */}
        {!isSubscription && selectedDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Time Slot</label>
            <div className="grid grid-cols-2 gap-2">
              {['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'].map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-3 rounded-lg border-2 transition-all ${
                    selectedSlot === slot
                      ? 'border-orange-500 bg-orange-50 text-orange-600 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-orange-300'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {isSubscription && (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-1">Subscription Schedule</h4>
                <p className="text-sm text-blue-600">
                    Provider will arrive daily during the <strong>{timeWindows.find(w => w.id === selectedTimeWindow)?.label}</strong> window 
                    ({timeWindows.find(w => w.id === selectedTimeWindow)?.time}).
                </p>
                <p className="text-xs text-blue-500 mt-2">
                    Exact arrival time may vary based on traffic and prior appointments.
                </p>
            </div>
        )}

        <Button
          onClick={handleBooking}
          disabled={loading || !selectedDate || (!isSubscription && !selectedSlot)}
          className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
        >
          {loading ? 'Processing...' : `Confirm ${isSubscription ? 'Subscription' : 'Booking'}`}
        </Button>
      </div>
    );
  };

  const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
                {step === 'timeWindow' && <TimeWindowStep />}
                {step === 'providers' && <ProvidersStep />}
                {step === 'schedule' && <ScheduleStep />}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
