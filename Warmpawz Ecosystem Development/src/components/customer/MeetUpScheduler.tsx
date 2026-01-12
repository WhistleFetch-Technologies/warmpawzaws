import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, MapPin, Star, Coffee, Clock,
  Calendar, Check, Navigation, Phone
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MeetUpSchedulerProps {
  matchId: string;
  phone: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function MeetUpScheduler({ matchId, phone, onBack, onSuccess }: MeetUpSchedulerProps) {
  const [cafes, setCafes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCafe, setSelectedCafe] = useState<any>(null);
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
          loadNearbyCafes(location.lat, location.lng);
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Please enable location to find nearby cafés');
          // Use default location (e.g., city center)
          loadNearbyCafes(12.9716, 77.5946); // Bangalore
        }
      );
    } else {
      loadNearbyCafes(12.9716, 77.5946);
    }
  };

  const loadNearbyCafes = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/nearby-cafes?lat=${lat}&lng=${lng}&radius=5`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setCafes(result.cafes || []);
        
        if (result.cafes.length === 0) {
          toast.info('No nearby cafés found. Try increasing search radius.');
        }
      }
    } catch (error) {
      console.error('Error loading cafés:', error);
      toast.error('Failed to load cafés');
    } finally {
      setLoading(false);
    }
  };

  const handleBookMeetup = async () => {
    if (!selectedCafe || !selectedDate || !selectedTime) {
      toast.error('Please select café, date and time');
      return;
    }

    try {
      setBooking(true);

      const dateTime = `${selectedDate}T${selectedTime}:00`;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/schedule-meetup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            matchId,
            userId: phone,
            cafeId: selectedCafe.id,
            dateTime,
            notes
          })
        }
      );

      if (response.ok) {
        toast.success('Meet-up scheduled! Both users have been notified 🎉');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to schedule meet-up');
      }
    } catch (error) {
      console.error('Error booking meet-up:', error);
      toast.error('Failed to schedule meet-up');
    } finally {
      setBooking(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby cafés...</p>
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
            <h1 className="font-bold text-lg text-gray-900">Schedule Meet-Up</h1>
            <p className="text-sm text-gray-600">Pick a pet-friendly café</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 pb-32">
        {/* Cafés List */}
        {cafes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Coffee className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No cafés found nearby</p>
            <p className="text-sm text-gray-500">Try adjusting your location or check back later</p>
          </div>
        ) : (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">
              Nearby Cafés ({cafes.length})
            </h2>
            <div className="space-y-3">
              {cafes.map((cafe) => (
                <button
                  key={cafe.id}
                  onClick={() => setSelectedCafe(cafe)}
                  className={`w-full text-left bg-white rounded-xl p-4 border-2 transition-all ${
                    selectedCafe?.id === cafe.id
                      ? 'border-pink-500 shadow-lg'
                      : 'border-gray-200 hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                      <Coffee className="w-6 h-6 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900">{cafe.businessName || 'Pet Café'}</h3>
                        {selectedCafe?.id === cafe.id && (
                          <Check className="w-5 h-5 text-pink-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-yellow-600 mt-1">
                        <Star className="w-4 h-4 fill-current" />
                        <span>4.5</span>
                        <span className="text-gray-500 ml-1">(124 reviews)</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                        <MapPin className="w-4 h-4" />
                        <span>{cafe.distance} km away</span>
                      </div>

                      {cafe.address && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {cafe.address}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date & Time Selection */}
        {selectedCafe && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Select Date & Time</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Time
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">Select time</option>
                {Array.from({ length: 12 }, (_, i) => i + 9).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Booking Summary */}
        {selectedCafe && selectedDate && selectedTime && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
            <h4 className="font-bold text-gray-900 mb-2">Booking Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Café:</span>
                <span className="font-medium text-gray-900">{selectedCafe.businessName}</span>
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
              <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                <span className="text-gray-600">Booking Fee:</span>
                <span className="font-bold text-green-700">₹75</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      {selectedCafe && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleBookMeetup}
              disabled={!selectedDate || !selectedTime || booking}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3"
            >
              {booking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Booking...
                </div>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm Meet-Up - ₹75
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
