import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { MapPin, Clock, Star, Calendar, ChevronRight, Heart, TrendingUp, Navigation, User } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

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
}

interface TimeWindow {
  id: string;
  label: string;
  time: string;
  icon: 'morning' | 'afternoon' | 'evening';
}

interface HomeServiceBookingEnhancedProps {
  serviceType: string;
  serviceName: string;
  customerId: string;
  petId: string;
  onBack: () => void;
  onBookingComplete: (bookingId: string) => void;
}

export function HomeServiceBookingEnhanced({
  serviceType,
  serviceName,
  customerId,
  petId,
  onBack,
  onBookingComplete
}: HomeServiceBookingEnhancedProps) {
  const [step, setStep] = useState<'timeWindow' | 'providers' | 'schedule'>('timeWindow');
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string>('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [previousProviders, setPreviousProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const timeWindows: TimeWindow[] = [
    { id: 'morning', label: 'Morning', time: '8:00 AM - 12:00 PM', icon: 'morning' },
    { id: 'afternoon', label: 'Afternoon', time: '12:00 PM - 4:00 PM', icon: 'afternoon' },
    { id: 'evening', label: 'Evening', time: '4:00 PM - 8:00 PM', icon: 'evening' }
  ];

  useEffect(() => {
    loadPreviousProviders();
  }, [customerId, serviceType]);

  useEffect(() => {
    if (selectedTimeWindow) {
      loadProviders();
    }
  }, [selectedTimeWindow]);

  const loadPreviousProviders = async () => {
    try {
      // Load customer's booking history to find previously used providers
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/bookings`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const bookings = data.bookings || [];
        
        // Extract unique providers from completed bookings
        const usedProviderIds = new Set(
          bookings
            .filter((b: any) => b.status === 'completed' && b.serviceType === serviceType)
            .map((b: any) => b.vendorId)
        );

        // Create provider objects from booking history
        const previousList: Provider[] = Array.from(usedProviderIds).map((id: any) => {
          const booking = bookings.find((b: any) => b.vendorId === id);
          return {
            id,
            name: booking?.vendorName || 'Provider',
            photo: booking?.vendorPhoto || '',
            rating: booking?.vendorRating || 4.5,
            reviews: booking?.vendorReviews || 0,
            distance: 0,
            commuteTime: 0,
            price: booking?.totalAmount || 0,
            previouslyUsed: true,
            isAvailable: true
          };
        });

        setPreviousProviders(previousList);
      }
    } catch (error) {
      console.error('Error loading previous providers:', error);
    }
  };

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);

      // Get customer location (would come from customer profile)
      const customerLocation = { lat: 28.6139, lng: 77.2090 }; // Delhi

      // Search for providers based on service type and time window
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover/vendors?serviceType=${serviceType}&timeWindow=${selectedTimeWindow}&lat=${customerLocation.lat}&lng=${customerLocation.lng}&radius=10`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const vendorList = data.vendors || [];

        // Transform to provider format with distance and commute time
        const transformedProviders: Provider[] = vendorList.map((v: any) => ({
          id: v.id,
          name: v.businessName || v.fullName,
          photo: v.profilePhoto || '',
          rating: v.rating || 4.5,
          reviews: v.totalReviews || 0,
          distance: v.distance || 0,
          commuteTime: calculateCommuteTime(v.distance || 0),
          price: v.basePrice || 0,
          previouslyUsed: previousProviders.some(p => p.id === v.id),
          isAvailable: v.isAvailable !== false,
          nextAvailableSlot: v.nextAvailableSlot,
          specialization: v.specialization
        }));

        // Sort: previous providers first, then by distance
        transformedProviders.sort((a, b) => {
          if (a.previouslyUsed && !b.previouslyUsed) return -1;
          if (!a.previouslyUsed && b.previouslyUsed) return 1;
          return a.distance - b.distance;
        });

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

  const calculateCommuteTime = (distance: number): number => {
    // Simple calculation: assume 20 km/h average speed in city
    return Math.ceil((distance / 20) * 60); // minutes
  };

  const handleTimeWindowSelect = (windowId: string) => {
    setSelectedTimeWindow(windowId);
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setStep('schedule');
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) {
      toast.error('Please select a date and time slot');
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
        scheduledTime: selectedSlot,
        timeWindow: selectedTimeWindow,
        address: {}, // Would come from customer profile
        totalAmount: provider?.price || 0,
        commuteTime: provider?.commuteTime || 0,
        distance: provider?.distance || 0,
        previouslyUsed: provider?.previouslyUsed || false
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
        toast.success('Booking created successfully!');
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

  const renderTimeWindowSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your Preferred Time</h2>
        <p className="text-gray-600">Select a time window that works best for you</p>
      </div>

      <div className="space-y-3">
        {timeWindows.map((window) => (
          <button
            key={window.id}
            onClick={() => handleTimeWindowSelect(window.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all ${
              selectedTimeWindow === window.id
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-orange-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                window.icon === 'morning' ? 'bg-yellow-100' :
                window.icon === 'afternoon' ? 'bg-orange-100' :
                'bg-purple-100'
              }`}>
                {window.icon === 'morning' && (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                {window.icon === 'afternoon' && (
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                {window.icon === 'evening' && (
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">{window.label}</p>
                <p className="text-sm text-gray-600">{window.time}</p>
              </div>
              {selectedTimeWindow === window.id && (
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
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

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setStep('timeWindow')} className="text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Choose Your Service Provider</h2>
          <p className="text-sm text-gray-600">
            {timeWindows.find(w => w.id === selectedTimeWindow)?.time}
          </p>
        </div>
      </div>

      {/* Previous Providers - Horizontal Scroll */}
      {previousProviders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <h3 className="font-semibold text-gray-900">Your Trusted Providers</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {previousProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className="flex-shrink-0 w-32 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-3 text-center hover:shadow-md transition-all"
              >
                <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-white">
                  {provider.photo ? (
                    <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-orange-100">
                      <User className="w-8 h-8 text-orange-600" />
                    </div>
                  )}
                </div>
                <p className="font-medium text-sm text-gray-900 truncate">{provider.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs text-gray-600">{provider.rating}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Providers - Radar List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Available Nearby</h3>
          <span className="text-sm text-gray-600">{providers.length} providers</span>
        </div>

        {loadingProviders ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Finding providers...</p>
          </div>
        ) : (
          <div className="space-y-3">
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
                        <span className="text-gray-400">({provider.reviews})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{provider.distance.toFixed(1)} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{provider.commuteTime} min</span>
                      </div>
                    </div>
                    {provider.specialization && (
                      <p className="text-xs text-gray-500 mt-1">{provider.specialization}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-orange-600">₹{provider.price}</span>
                      {!provider.isAvailable && (
                        <span className="text-xs text-gray-500">Next: {provider.nextAvailableSlot}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderScheduleSelection = () => {
    const provider = providers.find(p => p.id === selectedProvider);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('providers')} className="text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Schedule Appointment</h2>
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
                <MapPin className="w-3 h-3" />
                <span>{provider?.distance.toFixed(1)} km away</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{provider?.commuteTime} min travel</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-orange-600">₹{provider?.price}</p>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Time Slot Selection */}
        {selectedDate && (
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

        <Button
          onClick={handleBooking}
          disabled={loading || !selectedDate || !selectedSlot}
          className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
        >
          {loading ? 'Creating Booking...' : `Book for ₹${provider?.price}`}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        {step === 'timeWindow' && renderTimeWindowSelection()}
        {step === 'providers' && renderProviderSelection()}
        {step === 'schedule' && renderScheduleSelection()}
      </div>
    </div>
  );
}
