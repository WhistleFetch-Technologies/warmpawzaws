import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, MapPin, Star, Calendar, Clock, DollarSign, User, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { WalkerSelection } from './WalkerSelection';
import { WalkerBookingConfirm } from './WalkerBookingConfirm';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  photo?: string;
}

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
}

export function WalkerService({ phone, onBack }: { phone: string; onBack: () => void }) {
  const [step, setStep] = useState<'select' | 'walkers' | 'confirm'>('select');
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    petId: '',
    petName: '',
    duration: '30',
    schedule: 'morning',
    frequency: 'single',
    sessionsPerDay: 1
  });

  useEffect(() => {
    loadPets();
    getUserLocation();
  }, []);

  const loadPets = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/pets/${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setPets(result.pets?.pets || []);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Location obtained:', position.coords.latitude, position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          // Gracefully handle location errors
          if (error.code === 1) {
            console.log('💡 Location permission denied by user - using default location');
          } else if (error.code === 2) {
            console.log('💡 Location unavailable - using default location');
          } else if (error.code === 3) {
            console.log('💡 Location request timeout - using default location');
          }
          // Default to Bangalore coordinates
          setUserLocation({ lat: 12.9716, lng: 77.5946 });
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      console.log('Geolocation not supported, using default location');
      setUserLocation({ lat: 12.9716, lng: 77.5946 });
    }
  };

  const handlePetSelect = (pet: Pet) => {
    setBookingDetails({
      ...bookingDetails,
      petId: pet.id,
      petName: pet.name
    });
  };

  const handleNext = () => {
    if (!bookingDetails.petId) {
      alert('Please select a pet');
      return;
    }
    if (bookingDetails.duration === 'custom' && (!bookingDetails.customDuration || bookingDetails.customDuration < 15)) {
      alert('Please enter a valid custom duration (minimum 15 minutes)');
      return;
    }
    setStep('walkers');
  };

  const handleWalkerSelect = (walkerId: string) => {
    setStep('confirm');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === 'walkers') {
    return (
      <WalkerSelection
        bookingDetails={bookingDetails}
        userLocation={userLocation}
        phone={phone}
        onBack={() => setStep('select')}
        onSelectWalker={handleWalkerSelect}
      />
    );
  }

  if (step === 'confirm') {
    return (
      <WalkerBookingConfirm
        bookingDetails={bookingDetails}
        phone={phone}
        onBack={() => setStep('walkers')}
        onBackToHome={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto pb-24">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-16 sticky top-0 z-10 relative">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Dog Walking Service</h1>
            <p className="text-white/90 text-sm">Book a trusted walker for your pet</p>
          </div>
        </div>
        
        {/* Concave curve - curves inward */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Step 1: Select Pet */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold">1</div>
            <h2 className="text-black font-semibold">Select Your Pet</h2>
          </div>
          
          {pets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No pets found</p>
              <p className="text-sm">Please add a pet profile first</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => handlePetSelect(pet)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    bookingDetails.petId === pet.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{pet.type === 'Dog' ? '🐕' : '🐈'}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-800">{pet.name}</h3>
                    <p className="text-sm text-gray-600">{pet.breed} • {pet.type}</p>
                  </div>
                  {bookingDetails.petId === pet.id && (
                    <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Choose Duration */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold">2</div>
            <h2 className="text-black font-semibold">Walk Duration</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-3">
            {(['30', '60', 'custom'] as const).map((duration) => (
              <button
                key={duration}
                onClick={() => setBookingDetails({ ...bookingDetails, duration })}
                className={`py-3 px-4 rounded-xl border-2 transition-all ${
                  bookingDetails.duration === duration
                    ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <Clock className="w-5 h-5 mx-auto mb-1" />
                <p className="text-sm font-semibold">
                  {duration === '30' ? '30 min' : duration === '60' ? '60 min' : 'Custom'}
                </p>
              </button>
            ))}
          </div>

          {bookingDetails.duration === 'custom' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="180"
                value={bookingDetails.customDuration || ''}
                onChange={(e) => setBookingDetails({ ...bookingDetails, customDuration: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                placeholder="Enter duration in minutes"
              />
            </div>
          )}
        </div>

        {/* Step 3: Choose Schedule */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h2 className="text-black font-semibold">Preferred Time</h2>
          </div>
          
          <div className="space-y-3">
            {[
              { value: 'morning', label: 'Morning Walk', time: '6:00 AM - 10:00 AM', icon: '🌅' },
              { value: 'evening', label: 'Evening Walk', time: '4:00 PM - 8:00 PM', icon: '🌆' },
              { value: 'anytime', label: 'Anytime', time: 'Flexible timing', icon: '⏰' }
            ].map((schedule) => (
              <button
                key={schedule.value}
                onClick={() => setBookingDetails({ ...bookingDetails, schedule: schedule.value as any })}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  bookingDetails.schedule === schedule.value
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-3xl">{schedule.icon}</span>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-800">{schedule.label}</h3>
                  <p className="text-sm text-gray-600">{schedule.time}</p>
                </div>
                {bookingDetails.schedule === schedule.value && (
                  <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Choose Frequency */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold">4</div>
            <h2 className="text-black font-semibold">Booking Frequency</h2>
          </div>
          
          <div className="space-y-3">
            {[
              { value: 'single', label: 'Single Walk', desc: 'One-time booking', price: 'From ₹199', icon: '1️⃣' },
              { value: 'weekly', label: 'Weekly Package', desc: '7 walks • Mon-Sun', price: 'From ₹1,199', discount: 'Save 15%', icon: '📅' },
              { value: 'monthly', label: 'Monthly Package', desc: '30 walks • 1x or 2x daily', price: 'From ₹3,999', discount: 'Save 30%', icon: '📆' }
            ].map((freq) => (
              <button
                key={freq.value}
                onClick={() => setBookingDetails({ ...bookingDetails, frequency: freq.value as any })}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  bookingDetails.frequency === freq.value
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-3xl">{freq.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{freq.label}</h3>
                    {freq.discount && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {freq.discount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{freq.desc}</p>
                  <p className="text-sm font-semibold text-[#FF8C42]">{freq.price}</p>
                </div>
                {bookingDetails.frequency === freq.value && (
                  <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {bookingDetails.frequency === 'monthly' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Walks per day
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((count) => (
                  <button
                    key={count}
                    onClick={() => setBookingDetails({ ...bookingDetails, sessionsPerDay: count })}
                    className={`py-3 px-4 rounded-xl border-2 transition-all ${
                      bookingDetails.sessionsPerDay === count
                        ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <p className="text-lg font-bold">{count}x</p>
                    <p className="text-xs">{count === 1 ? 'Once daily' : 'Twice daily'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleNext}
          disabled={!bookingDetails.petId}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold disabled:opacity-50"
        >
          View Available Walkers
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}