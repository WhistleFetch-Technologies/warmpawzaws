import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ArrowLeft, Home, MapPin, Navigation, Star, User, Clock, Check, Phone } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { UniversalHomeServiceTracking } from './UniversalHomeServiceTracking';

interface HomeVisitProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
}

export function HomeVisit({ onBack, customerId, petProfiles }: HomeVisitProps) {
  const [step, setStep] = useState<'pets' | 'address' | 'doctors' | 'slots' | 'confirm' | 'tracking'>('pets');
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState<any>(null);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAddress(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
          toast.success('Location detected!');
        },
        (error) => {
          // User-friendly messages based on error type
          if (error.code === 1) {
            console.log('💡 Location permission denied by user');
            toast.warning('Location access denied. You can enter your address manually.');
          } else if (error.code === 2) {
            console.log('💡 Location unavailable');
            toast.warning('Location unavailable. Please enter your address manually.');
          } else {
            console.log('💡 Location request timeout');
            toast.warning('Unable to detect location. Please enter your address manually.');
          }
        }
      );
    }
  };

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/doctors?serviceType=home`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setDoctors(data.doctors || []);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/slots?vendorId=${selectedDoctor.id}&date=${selectedDate}&serviceType=home`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBooking = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/booking`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            customerId,
            petId: selectedPet.id,
            vendorId: selectedDoctor.id,
            serviceType: 'home_visit',
            slotId: selectedSlot.id,
            date: selectedDate,
            time: selectedSlot.time,
            address,
            price: 800
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        toast.success('Home visit booked!');
        setStep('tracking');
        // Use real booking data
        setTracking({
          bookingId: data.booking.id,
          status: 'pending', // It will start as pending until accepted
          technicianName: selectedDoctor.name,
          technicianPhone: selectedDoctor.phone,
          serviceType: 'Home Vet Visit'
        });
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'doctors') loadDoctors();
  }, [step]);

  useEffect(() => {
    if (step === 'slots' && selectedDoctor) loadSlots();
  }, [step, selectedDate, selectedDoctor]);

  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate()
      });
    }
    return days;
  };

  // Pet Selection
  if (step === 'pets') {
    return (
      <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-[#FF8C42] white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-6 h-3 bg-[#FF8C42] black/30"></div>
          </div>
        </div>

        <div className="bg-[#FF8C42] gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="w-10 h-10 bg-[#FF8C42] white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Home Visit</h1>
          </div>
          <Card className="bg-[#FF8C42] white/10 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FF8C42] white/20 rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white">Vet Comes to You</h3>
                <p className="text-white/80 text-sm">Convenient home service</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex-1 -mt-4 bg-[#FF8C42] white rounded-t-[32px] px-6 pt-6 pb-24">
          <h2 className="mb-4">Select Pet Profile</h2>
          <div className="space-y-3">
            {petProfiles.map((pet: any) => (
              <button key={pet.id} onClick={() => { setSelectedPet(pet); setStep('address'); }} className="w-full">
                <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#FF8C42] green-100 rounded-2xl flex items-center justify-center text-2xl">
                      {pet.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="mb-1">{pet.name}</h3>
                      <p className="text-sm text-gray-500">{pet.breed} • {pet.age}</p>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-[#FF8C42] black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Address Entry
  if (step === 'address') {
    return (
      <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-[#FF8C42] white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-6 h-3 bg-[#FF8C42] black/30"></div>
          </div>
        </div>

        <div className="bg-[#FF8C42] gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('pets')} className="w-10 h-10 bg-[#FF8C42] white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Enter Address</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-[#FF8C42] white rounded-t-[32px] px-6 pt-6 pb-24">
          <div className="mb-6">
            <label className="block mb-2">Service Address</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your full address"
              className="mb-3"
            />
            <Button onClick={detectLocation} variant="outline" className="w-full">
              <Navigation className="w-4 h-4 mr-2" />
              Detect Current Location
            </Button>
          </div>

          <Button
            onClick={() => setStep('doctors')}
            disabled={!address}
            className="w-full bg-green-600 hover:bg-[#FF8C42] green-700"
          >
            Continue
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-[#FF8C42] black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Doctor Selection (Similar to TeleConsultation)
  if (step === 'doctors') {
    return (
      <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-[#FF8C42] white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-6 h-3 bg-[#FF8C42] black/30"></div>
          </div>
        </div>

        <div className="bg-[#FF8C42] gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('address')} className="w-10 h-10 bg-[#FF8C42] white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Select Vet</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-[#FF8C42] white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map((doctor: any) => (
                <button key={doctor.id} onClick={() => { setSelectedDoctor(doctor); setStep('slots'); }} className="w-full">
                  <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-[#FF8C42] green-100 rounded-2xl flex items-center justify-center">
                        <User className="w-8 h-8 text-green-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="mb-1">{doctor.name}</h3>
                            <p className="text-sm text-gray-500">{doctor.specialization}</p>
                          </div>
                          <div className="flex items-center gap-1 bg-[#FF8C42] green-100 px-2 py-1 rounded-lg">
                            <Star className="w-3 h-3 text-green-600 fill-green-600" />
                            <span className="text-sm text-green-600">{doctor.rating}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-green-600">₹{doctor.consultationFee + 300}</div>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-[#FF8C42] black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Slots (similar structure)
  if (step === 'slots') {
    const nextDays = getNextDays();
    return (
      <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-[#FF8C42] white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-6 h-3 bg-[#FF8C42] black/30"></div>
          </div>
        </div>

        <div className="bg-[#FF8C42] gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('doctors')} className="w-10 h-10 bg-[#FF8C42] white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Select Time Slot</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-[#FF8C42] white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="mb-6">
            <h3 className="mb-3">Select Date</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
              {nextDays.map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 ${
                    selectedDate === day.date ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <span className="text-xs text-gray-500">{day.day}</span>
                  <span className={selectedDate === day.date ? 'text-green-600' : ''}>{day.dayNum}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3">Available Slots</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {slots.filter(s => s.available).map((slot: any) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-3 rounded-xl border-2 ${
                      selectedSlot?.id === slot.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-center">
                      <Clock className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-sm">{slot.displayTime}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white border-t p-4 max-w-md mx-auto">
            <Button onClick={() => setStep('confirm')} className="w-full bg-green-600 hover:bg-[#FF8C42] green-700">
              Continue to Payment
            </Button>
            <div className="flex justify-center mt-3">
              <div className="w-32 h-1 bg-[#FF8C42] black rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Confirmation
  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-[#FF8C42] white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-4 h-3 bg-[#FF8C42] black/30"></div>
            <div className="w-6 h-3 bg-[#FF8C42] black/30"></div>
          </div>
        </div>

        <div className="bg-[#FF8C42] gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('slots')} className="w-10 h-10 bg-[#FF8C42] white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Confirm Booking</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-[#FF8C42] white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-4 border-gray-200 mb-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Vet</span>
                <span>{selectedDoctor.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time</span>
                <span>{new Date(selectedDate).toLocaleDateString()} at {selectedSlot.displayTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Address</span>
                <span className="text-right text-xs">{address}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-500">Total</span>
                <span className="text-2xl text-green-600">₹800</span>
              </div>
            </div>
          </Card>

          <Button onClick={createBooking} disabled={loading} className="w-full bg-green-600 hover:bg-[#FF8C42] green-700">
            {loading ? 'Booking...' : 'Confirm & Pay'}
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-[#FF8C42] black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Live Tracking
  if (step === 'tracking') {
    return (
      <UniversalHomeServiceTracking
        bookingId={tracking?.bookingId}
        trackingSessionId={tracking?.trackingSessionId} // Might be null initially
        onClose={() => setStep('pets')} // Or go to home
        staffName={tracking?.technicianName}
        staffPhone={tracking?.technicianPhone}
        serviceType={tracking?.serviceType}
        customerName="You" // Could pass actual name
      />
    );
  }

  return null;
}
