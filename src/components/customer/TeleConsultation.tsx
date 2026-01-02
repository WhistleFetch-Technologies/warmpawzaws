import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { VideoCallInterface } from './VideoCallInterface';
import {
  ArrowLeft,
  Video,
  Star,
  Clock,
  GraduationCap,
  Check,
  Calendar,
  ChevronRight,
  User
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface TeleConsultationProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
  customerName?: string;
  customerPhone?: string;
}

export function TeleConsultation({ onBack, customerId, petProfiles, customerName = 'Customer', customerPhone = '0000000000' }: TeleConsultationProps) {
  const [step, setStep] = useState<'pets' | 'doctors' | 'slots' | 'payment' | 'video' | 'prescription'>('pets');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (step === 'doctors') {
      loadDoctors();
    }
  }, [step]);

  useEffect(() => {
    if (step === 'slots' && selectedDoctor) {
      loadSlots();
    }
  }, [step, selectedDate, selectedDoctor]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/doctors?serviceType=tele`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDoctors(data.doctors || []);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/slots?vendorId=${selectedDoctor.id}&date=${selectedDate}&serviceType=tele`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Failed to load time slots');
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            customerId,
            petId: selectedPet.id,
            vendorId: selectedDoctor.id,
            serviceType: 'tele',
            slotId: selectedSlot.id,
            date: selectedDate,
            time: selectedSlot.time,
            price: selectedDoctor.consultationFee
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking);
        toast.success('Booking confirmed!');
        setStep('video');
      } else {
        toast.error('Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Generate next 7 days
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

  // Pet Selection Step
  if (step === 'pets') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button 
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Tele Consultation</h1>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white">Video Call with Expert Vet</h3>
              <p className="text-white/80 text-sm">Consult from anywhere, anytime</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
          <h2 className="mb-4">Select Pet Profile</h2>

          <div className="space-y-3">
            {petProfiles.map((pet: any) => (
              <button
                key={pet.id}
                onClick={() => {
                  setSelectedPet(pet);
                  setStep('doctors');
                }}
                className="w-full"
              >
                <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">
                      {pet.icon || '🐶'}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="mb-1">{pet.name}</h3>
                      <p className="text-sm text-gray-500">{pet.breed} • {pet.age}</p>
                      <p className="text-xs text-gray-400 mt-1">{pet.weight}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>

        {/* Home Indicator */}
        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Doctor Selection Step
  if (step === 'doctors') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button 
              onClick={() => setStep('pets')}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Select Doctor</h1>
          </div>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                {selectedPet.icon || '🐶'}
              </div>
              <div>
                <h3 className="text-white">{selectedPet.name}</h3>
                <p className="text-white/80 text-sm">{selectedPet.breed}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map((doctor: any) => (
                <button
                  key={doctor.id}
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setStep('slots');
                  }}
                  className="w-full"
                >
                  <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                        <User className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="mb-1">{doctor.name}</h3>
                            <p className="text-sm text-gray-500">{doctor.specialization}</p>
                          </div>
                          <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded-lg">
                            <Star className="w-3 h-3 text-green-600 fill-green-600" />
                            <span className="text-sm text-green-600">{doctor.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" />
                            <span>{doctor.experience}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>30 min</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-blue-600">₹{doctor.consultationFee}</span>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Home Indicator */}
        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Time Slot Selection Step
  if (step === 'slots') {
    const nextDays = getNextDays();

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button 
              onClick={() => setStep('doctors')}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Select Time Slot</h1>
          </div>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white">{selectedDoctor.name}</h3>
                <p className="text-white/80 text-sm">{selectedDoctor.specialization}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          {/* Date Selection */}
          <div className="mb-6">
            <h3 className="mb-3">Select Date</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
              {nextDays.map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedDate === day.date
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <span className="text-xs text-gray-500">{day.day}</span>
                  <span className={selectedDate === day.date ? 'text-blue-600' : ''}>{day.dayNum}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots */}
          <div>
            <h3 className="mb-3">Available Slots</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {slots.filter(s => s.available).map((slot: any) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedSlot?.id === slot.id
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-blue-200'
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

        {/* Bottom CTA */}
        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Consultation Fee</div>
                <div className="text-2xl text-blue-600">₹{selectedDoctor.consultationFee}</div>
              </div>
              <Button 
                onClick={() => setStep('payment')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Payment
              </Button>
            </div>
            <div className="flex justify-center">
              <div className="w-32 h-1 bg-black rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Payment Step
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button 
              onClick={() => setStep('slots')}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Confirm Booking</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <h2 className="mb-4">Booking Summary</h2>

          <Card className="p-4 border-gray-200 mb-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm mb-1">{selectedDoctor.name}</h3>
                  <p className="text-xs text-gray-500">{selectedDoctor.specialization}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm">{selectedDoctor.rating}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pet</span>
                  <span>{selectedPet.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span>{selectedSlot.displayTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Type</span>
                  <span>Tele Consultation</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="text-2xl text-blue-600">₹{selectedDoctor.consultationFee}</span>
                </div>
              </div>
            </div>
          </Card>

          <Button 
            onClick={createBooking}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Confirm & Pay'}
          </Button>
        </div>

        {/* Home Indicator */}
        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  // Video Consultation Interface
  if (step === 'video') {
    return (
      <VideoCallInterface
        bookingId={booking?.id || 'temp-booking-id'}
        customerPhone={customerPhone}
        customerName={customerName}
        vendorName={selectedDoctor?.name || 'Dr. Vet'}
        petName={selectedPet?.name || 'Pet'}
        scheduledDate={selectedDate}
        scheduledTime={selectedSlot?.displayTime || 'Now'}
        isInstantConsultation={true}
        onClose={() => setStep('prescription')}
      />
    );
  }

  // Prescription View (after consultation)
  if (step === 'prescription') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button 
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Prescription</h1>
          </div>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white">Consultation Complete</h3>
                <p className="text-white/80 text-sm">Prescription is ready</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-4 border-gray-200 mb-6">
            <h3 className="mb-3">Prescribed Medicines</h3>
            <div className="space-y-3">
              {[
                { name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days' },
                { name: 'Vitamin Supplement', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days' }
              ].map((med, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1">{med.name}</h4>
                    <p className="text-sm text-gray-600">{med.dosage} - {med.frequency}</p>
                    <p className="text-xs text-gray-500 mt-1">Duration: {med.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Order Medicines
            </Button>
            <Button variant="outline" className="w-full">
              Book Follow-Up
            </Button>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  return null;
}
