import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, MapPin, Star, Stethoscope, Clock,
  Calendar, Check, Shield, Award, Phone
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface MatingAppointmentSchedulerProps {
  matchId: string;
  phone: string;
  petIds: string[];
  onBack: () => void;
  onSuccess: () => void;
}

export function MatingAppointmentScheduler({ 
  matchId, 
  phone, 
  petIds = [], 
  onBack, 
  onSuccess 
}: MatingAppointmentSchedulerProps) {
  const [vets, setVets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVet, setSelectedVet] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          loadNearbyVets(location.lat, location.lng);
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Please enable location to find nearby vets');
          // Use default location
          loadNearbyVets(12.9716, 77.5946); // Bangalore
        }
      );
    } else {
      loadNearbyVets(12.9716, 77.5946);
    }
  };

  const loadNearbyVets = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/nearby-vets?lat=${lat}&lng=${lng}&radius=10`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setVets(result.vets || []);
        
        if (result.vets.length === 0) {
          toast.info('No nearby vet clinics found. Try increasing search radius.');
        }
      }
    } catch (error) {
      console.error('Error loading vets:', error);
      toast.error('Failed to load vet clinics');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedVet || !selectedDate || !selectedTime) {
      toast.error('Please select vet clinic, date and time');
      return;
    }

    try {
      setBooking(true);

      const dateTime = `${selectedDate}T${selectedTime}:00`;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/request-mating-appointment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            matchId,
            userId: phone,
            vetClinicId: selectedVet.id,
            dateTime,
            notes
          })
        }
      );

      if (response.ok) {
        toast.success('Mating appointment requested! Vet will confirm shortly 🎉');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Minimum 1 day advance
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    return maxDate.toISOString().split('T')[0];
  };

  const calculateServiceFee = (vet: any) => {
    // Base fee + distance-based fee
    const baseFee = 1500;
    const distanceFee = Math.round(parseFloat(vet.distance) * 50);
    return baseFee + distanceFee;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby vet clinics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-gray-900">Mating Appointment</h1>
            <p className="text-sm text-gray-600">Select a vet clinic</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 pb-32">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Professional Service</p>
              <p className="text-xs text-blue-700 mt-1">
                All clinics are verified and provide supervised mating services with post-care support.
              </p>
            </div>
          </div>
        </div>

        {/* Vets List */}
        {vets.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No vet clinics found nearby</p>
            <p className="text-sm text-gray-500">Try adjusting your location or check back later</p>
          </div>
        ) : (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">
              Nearby Vet Clinics ({vets.length})
            </h2>
            <div className="space-y-3">
              {vets.map((vet) => {
                const serviceFee = calculateServiceFee(vet);

                return (
                  <button
                    key={vet.id}
                    onClick={() => setSelectedVet(vet)}
                    className={`w-full text-left bg-white rounded-xl p-4 border-2 transition-all ${
                      selectedVet?.id === vet.id
                        ? 'border-pink-500 shadow-lg'
                        : 'border-gray-200 hover:border-pink-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-6 h-6 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{vet.businessName || 'Vet Clinic'}</h3>
                            {vet.specialization && (
                              <p className="text-xs text-gray-600">{vet.specialization}</p>
                            )}
                          </div>
                          {selectedVet?.id === vet.id && (
                            <Check className="w-5 h-5 text-pink-500 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-sm text-yellow-600">
                            <Star className="w-4 h-4 fill-current" />
                            <span>4.8</span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <Award className="w-3 h-3" />
                            <span>Verified</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                          <MapPin className="w-4 h-4" />
                          <span>{vet.distance} km away</span>
                        </div>

                        {vet.address && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {vet.address}
                          </p>
                        )}

                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Service Fee:</span>
                            <span className="font-bold text-green-700">₹{serviceFee.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Date & Time Selection */}
        {selectedVet && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Select Date & Time</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Preferred Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 1 day advance booking</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Preferred Time
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">Select time</option>
                {Array.from({ length: 9 }, (_, i) => i + 9).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any health concerns, special requirements, or questions..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Service Details */}
        {selectedVet && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              What's Included
            </h4>
            <div className="space-y-2 text-sm">
              {[
                'Pre-mating health check',
                'Supervised mating session',
                'Post-mating care consultation',
                'Pregnancy confirmation (if applicable)',
                'Follow-up support for 30 days'
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking Summary */}
        {selectedVet && selectedDate && selectedTime && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
            <h4 className="font-bold text-gray-900 mb-2">Appointment Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Clinic:</span>
                <span className="font-medium text-gray-900 text-right">{selectedVet.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('en-IN', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-gray-900">{selectedTime}</span>
              </div>
              <div className="flex justify-between border-t border-purple-300 pt-2 mt-2">
                <span className="text-gray-600">Service Fee:</span>
                <span className="font-bold text-purple-700">₹{calculateServiceFee(selectedVet).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Payment will be processed after vet confirms availability
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      {selectedVet && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleBookAppointment}
              disabled={!selectedDate || !selectedTime || booking}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3"
            >
              {booking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Requesting...
                </div>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Request Appointment - ₹{calculateServiceFee(selectedVet).toLocaleString()}
                </>
              )}
            </Button>
            <p className="text-xs text-center text-gray-500 mt-2">
              Vet will confirm your appointment within 24 hours
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
