import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  ArrowLeft,
  Building,
  MapPin,
  Star,
  Clock,
  Phone,
  Navigation,
  ChevronRight,
  Scissors,
  Search,
  Filter,
  Heart,
  Check
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface GroomingCenterVisitProps {
  onBack: () => void;
  customerId: string;
  customerData: any;
}

export function GroomingCenterVisit({ onBack, customerId, customerData }: GroomingCenterVisitProps) {
  const [step, setStep] = useState<'list' | 'services' | 'booking' | 'confirmation' | 'otp'>('list');
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<any>(null);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance');
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    loadCenters();
    loadPets();
  }, []);

  const loadCenters = async () => {
    try {
      setLoading(true);
      const lat = customerData?.coordinates?.lat || 12.9716;
      const lng = customerData?.coordinates?.lng || 77.5946;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendors/by-role/groomer?lat=${lat}&lng=${lng}&serviceStyle=clinic`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCenters(data.vendors || []);
      }
    } catch (error) {
      console.error('Error loading grooming centers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPets = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/pets`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPets(data.pets || []);
        if (data.pets?.length > 0) {
          setSelectedPet(data.pets[0]);
        }
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const loadCenterServices = async (centerId: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${centerId}/services`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableServices(data.services || []);
        setStep('services');
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCenter = (center: any) => {
    setSelectedCenter(center);
    loadCenterServices(center.id);
  };

  const toggleService = (service: any) => {
    const exists = selectedServices.find(s => s.id === service.id);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const proceedToBooking = () => {
    if (selectedServices.length === 0) {
      alert('Please select at least one service');
      return;
    }
    setStep('booking');
  };

  const createBooking = async () => {
    try {
      setLoading(true);

      const totalAmount = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
      const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);

      const bookingPayload = {
        customerId,
        vendorId: selectedCenter.id,
        petId: selectedPet.id,
        serviceId: 'grooming',
        serviceName: selectedServices.map(s => s.name).join(', '),
        serviceType: 'grooming_center',
        serviceLocation: 'clinic',
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        duration: totalDuration,
        frequency: 'once',
        address: selectedCenter.address,
        coordinates: selectedCenter.coordinates,
        basePrice: totalAmount,
        taxes: Math.round(totalAmount * 0.18),
        discount: 0,
        totalAmount: Math.round(totalAmount * 1.18),
        selectedServices: selectedServices.map(s => s.id)
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(bookingPayload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBookingData(data.booking);
        setStep('confirmation');
      } else {
        alert('Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const completeWithOTP = async () => {
    if (otpInput !== '123456') {
      alert('Invalid OTP. Use 123456 for UAT testing.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingData.id}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ otp: otpInput }),
        }
      );

      if (response.ok) {
        alert('✅ Grooming session completed! Please rate your experience.');
        onBack();
      } else {
        alert('Failed to complete booking');
      }
    } catch (error) {
      console.error('Error completing booking:', error);
      alert('Failed to complete booking');
    } finally {
      setLoading(false);
    }
  };

  const filteredCenters = centers
    .filter(center => 
      center.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      center.address?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'distance') return (a.distance || 0) - (b.distance || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'price') return (a.basePrice || 0) - (b.basePrice || 0);
      return 0;
    });

  // OTP STEP
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
          <button onClick={() => setStep('confirmation')} className="flex items-center gap-2 text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Scissors className="w-10 h-10 text-[#FF8C42]" />
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">Complete Grooming Session</h1>
          <p className="text-gray-600 mb-6">Enter the OTP provided by the groomer</p>

          <div className="max-w-sm mx-auto">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter 6-digit OTP"
              className="text-center text-2xl tracking-widest h-14 mb-4"
            />
            <p className="text-xs text-gray-500 mb-6">🔐 UAT Mode: OTP is 123456</p>

            <Button
              onClick={completeWithOTP}
              disabled={loading || otpInput.length !== 6}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] h-12"
            >
              {loading ? 'Completing...' : 'Complete Session'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // CONFIRMATION STEP
  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-6">Your grooming appointment is confirmed</p>

          <Card className="text-left mb-6">
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Grooming Center</p>
                  <p className="text-gray-900">{selectedCenter?.businessName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Scissors className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Services</p>
                  <p className="text-gray-900">{selectedServices.map(s => s.name).join(', ')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="text-gray-900">{selectedPet?.name}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="bg-orange-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">📌 Important</p>
            <p className="text-xs text-gray-600">After the grooming session is complete, the groomer will provide you with an OTP to confirm completion.</p>
          </div>

          <Button
            onClick={() => setStep('otp')}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] h-12 mb-3"
          >
            Complete with OTP
          </Button>

          <Button
            onClick={onBack}
            variant="outline"
            className="w-full h-12"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // BOOKING DETAILS STEP
  if (step === 'booking') {
    const totalAmount = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    const taxes = Math.round(totalAmount * 0.18);
    const finalAmount = totalAmount + taxes;

    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
          <button onClick={() => setStep('services')} className="flex items-center gap-2 text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-lg text-gray-900 mt-2">Confirm Booking</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Center Info */}
          <Card className="p-4">
            <h3 className="text-sm text-gray-500 mb-2">Grooming Center</h3>
            <p className="text-gray-900 mb-1">{selectedCenter?.businessName}</p>
            <p className="text-sm text-gray-600">{selectedCenter?.address}</p>
          </Card>

          {/* Pet Selection */}
          <Card className="p-4">
            <h3 className="text-sm text-gray-500 mb-3">Select Pet</h3>
            <div className="space-y-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(pet)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedPet?.id === pet.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-gray-900">{pet.name}</p>
                  <p className="text-sm text-gray-500">{pet.breed} • {pet.species}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Selected Services */}
          <Card className="p-4">
            <h3 className="text-sm text-gray-500 mb-3">Selected Services</h3>
            <div className="space-y-3">
              {selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between">
                  <div>
                    <p className="text-gray-900">{service.name}</p>
                    <p className="text-xs text-gray-500">{service.duration} mins</p>
                  </div>
                  <p className="text-gray-900">₹{service.price}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Price Breakdown */}
          <Card className="p-4">
            <h3 className="text-sm text-gray-500 mb-3">Price Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{totalAmount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxes (18%)</span>
                <span className="text-gray-900">₹{taxes}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-gray-900">Total</span>
                <span className="text-[#FF8C42] text-lg">₹{finalAmount}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 p-4">
          <Button
            onClick={createBooking}
            disabled={loading || !selectedPet}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] h-12"
          >
            {loading ? 'Creating Booking...' : `Confirm Booking • ₹${finalAmount}`}
          </Button>
        </div>
      </div>
    );
  }

  // SERVICES SELECTION STEP
  if (step === 'services') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
          <button onClick={() => setStep('list')} className="flex items-center gap-2 text-gray-700 mb-3">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-lg text-gray-900">{selectedCenter?.businessName}</h1>
          <p className="text-sm text-gray-500">{selectedCenter?.address}</p>
        </div>

        <div className="p-4">
          <h2 className="text-sm text-gray-500 mb-3">Select Services ({selectedServices.length} selected)</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <Scissors className="w-8 h-8 text-[#FF8C42] mx-auto mb-2 animate-spin" />
              <p className="text-gray-600">Loading services...</p>
            </div>
          ) : availableServices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No services available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableServices.map((service) => {
                const isSelected = selectedServices.find(s => s.id === service.id);
                return (
                  <Card
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected ? 'border-2 border-[#FF8C42] bg-orange-50' : 'border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-gray-900 mb-1">{service.name}</h3>
                        {service.description && (
                          <p className="text-sm text-gray-600">{service.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#FF8C42]">₹{service.price}</span>
                      <span className="text-sm text-gray-500">{service.duration} mins</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        {selectedServices.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 p-4">
            <Button
              onClick={proceedToBooking}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] h-12"
            >
              Continue ({selectedServices.length} services)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // CENTERS LIST (DEFAULT)
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-700 mb-3">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-lg text-gray-900 mb-3">Grooming Centers Near You</h1>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search centers..."
              className="pl-10"
            />
          </div>

          {/* Sort */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: 'distance', label: 'Nearest', icon: Navigation },
              { value: 'rating', label: 'Top Rated', icon: Star },
              { value: 'price', label: 'Price', icon: Filter }
            ].map((sort) => (
              <button
                key={sort.value}
                onClick={() => setSortBy(sort.value as any)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1.5 ${
                  sortBy === sort.value
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <sort.icon className="w-4 h-4" />
                {sort.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-[#FF8C42] mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Finding grooming centers...</p>
          </div>
        ) : filteredCenters.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No grooming centers found</p>
          </div>
        ) : (
          filteredCenters.map((center) => (
            <Card
              key={center.id}
              onClick={() => selectCenter(center)}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-gray-900 mb-1">{center.businessName}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{center.rating?.toFixed(1) || '4.5'}</span>
                    </div>
                    {center.distance && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{center.distance.toFixed(1)} km</span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>

              <p className="text-sm text-gray-600 mb-3">{center.address}</p>

              <div className="flex items-center justify-between">
                <span className="text-sm text-[#FF8C42]">
                  Starting from ₹{center.basePrice || 500}
                </span>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>30-90 mins</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
