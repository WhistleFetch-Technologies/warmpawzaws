"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LucideIcon, Palmtree, Calendar, Clock, MapPin, User, CheckCircle2, Plus, Dog, Cat, Users, Hotel, Camera, Utensils, Star } from 'lucide-react';
import { PrePaymentBookingReview } from '../booking/PrePaymentBookingReview';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { urlCustomerPetsByPhonePath } from '@/lib/customer-service-list-urls';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { toast } from 'sonner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';

interface HolidayBookingRouterProps {
  phone: string;
  vendorId?: string;
  holidayProvider?: any;
  selectedService?: string;
  serviceType?: string;
  serviceId?: string;
  serviceName?: string;
  serviceStyle?: string;
  price?: number;
  duration?: number;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

type BookingStep = 'package' | 'dates' | 'pet' | 'guests' | 'payment' | 'confirmation';

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

export function HolidayBookingRouter({ 
  phone, 
  vendorId, 
  holidayProvider, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  onBack, 
  onNavigate, 
  onViewBooking 
}: HolidayBookingRouterProps) {
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService);
  const initialStep: BookingStep = hasServiceContext ? 'dates' : 'package';
  const [step, setStep] = useState<BookingStep>(initialStep);
  
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && hasServiceContext && step === 'package') {
      setStep('dates');
      initializedRef.current = true;
    }
  }, [serviceId, serviceType, serviceStyle, step]);
  
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [selectedPets, setSelectedPets] = useState<Pet[]>([]);
  const [guestCount, setGuestCount] = useState(1);
  const [pets, setPets] = useState<Pet[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [holidayPackages, setHolidayPackages] = useState<any[]>([]);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomerData();
    if (vendorId) {
      loadHolidayPackages();
    }
  }, [phone, vendorId]);

  const loadCustomerData = async () => {
    try {
      const petsResponse = await apiClient.get<any>(urlCustomerPetsByPhonePath(phone));
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
      
      try {
        const profileResponse = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
        if (profileResponse?.profile?.id || profileResponse?.id) {
          setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
        }
      } catch (profileErr) {
        console.log('Could not get customer ID');
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  const loadHolidayPackages = async () => {
    if (!vendorId) return;
    
    try {
      setLoading(true);
      const servicesResponse = await apiClient.get(`/customer/vendor/${vendorId}/services?category=holiday`) as any;
      if (servicesResponse.success && servicesResponse.services) {
        setHolidayPackages(mergeCustomerVendorServicesPayload(servicesResponse));
      } else {
        // Default packages
        setHolidayPackages([
          {
            id: 'beach',
            name: 'Beach Vacation',
            price: 14999,
            duration: 3,
            description: 'Sunny beach getaway for you and your pet',
            icon: Palmtree,
            color: 'cyan'
          },
          {
            id: 'hill',
            name: 'Hill Station Retreat',
            price: 19999,
            duration: 4,
            description: 'Mountain retreat with pet-friendly accommodations',
            icon: Hotel,
            color: 'green'
          },
          {
            id: 'adventure',
            name: 'Adventure Tour',
            price: 24999,
            duration: 5,
            description: 'Activity-packed adventure for active pets',
            icon: Camera,
            color: 'orange'
          },
          {
            id: 'luxury',
            name: 'Luxury Stay',
            price: 34999,
            duration: 3,
            description: 'Premium luxury experience',
            icon: Utensils,
            color: 'purple'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading holiday packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPets = async () => {
    try {
      const petsResponse = await apiClient.get<any>(urlCustomerPetsByPhonePath(phone));
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
    } catch (err) {
      console.error('Error refreshing pets:', err);
    }
  };

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: formatLocalDateYYYYMMDD(date),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  const [dates] = useState(generateDates());

  const handleNext = () => {
    const steps: BookingStep[] = ['package', 'dates', 'pet', 'guests', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['package', 'dates', 'pet', 'guests', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  };

  const handleProceedToPayment = () => {
    setShowPaymentPage(true);
  };

  const handlePaymentSuccess = (newBookingId: string, orderId?: string, otpCode?: string) => {
    setBookingId(newBookingId);
    setShowPaymentPage(false);
    setStep('confirmation');
    toast.success('Holiday booking confirmed successfully!');
  };

  const togglePetSelection = (pet: Pet) => {
    if (selectedPets.find(p => p.id === pet.id)) {
      setSelectedPets(selectedPets.filter(p => p.id !== pet.id));
    } else {
      setSelectedPets([...selectedPets, pet]);
    }
  };

  const calculateTotal = () => {
    if (!selectedPackage) return 0;
    const basePrice = selectedPackage.price || price || 0;
    const petCount = selectedPets.length;
    const nights = checkInDate && checkOutDate 
      ? Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))
      : selectedPackage.duration || 3;
    
    return basePrice * nights + (petCount * 500 * nights); // Additional pet charges
  };

  const holidayPrePaymentStats = [
    { value: '—', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
    { value: '10k+', label: 'Stays' },
    { value: 'Pet', label: 'OK' },
  ];

  const getHolidayPackageIconAndStyle = (pkg: typeof selectedPackage) => {
    if (!pkg) {
      return { icon: Palmtree, iconClass: 'bg-cyan-100 text-cyan-600' as const };
    }
    const Icon = (typeof pkg.icon === 'function' ? (pkg.icon as LucideIcon) : Palmtree);
    const c = (pkg as { color?: string }).color;
    const iconClass =
      c === 'cyan' ? 'bg-cyan-100 text-cyan-600'
        : c === 'green' ? 'bg-green-100 text-green-600'
        : c === 'orange' ? 'bg-orange-100 text-orange-600'
        : c === 'purple' ? 'bg-purple-100 text-purple-600'
        : 'bg-cyan-100 text-cyan-600';
    return { icon: Icon, iconClass };
  };

  const renderStepIndicator = () => {
    const steps = ['Package', 'Dates', 'Pets', 'Guests', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      package: 0, dates: 1, pet: 2, guests: 3, payment: 4, confirmation: 5
    };
    const currentIdx = currentStepMap[step];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              idx <= currentIdx ? 'bg-[#FF8C42] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx < currentIdx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {step === 'payment' && !showPaymentPage && (() => {
        const { icon: HolidayPkgIcon, iconClass: holidayPkgIconClass } = getHolidayPackageIconAndStyle(selectedPackage);
        return (
        <PrePaymentBookingReview
          title="Booking Summary"
          subtitle="Review before payment"
          headerIcon={Palmtree}
          stats={holidayPrePaymentStats}
          onBack={handleBack}
          lead={{
            icon: HolidayPkgIcon,
            iconContainerClassName: holidayPkgIconClass,
            title: String(selectedPackage?.name ?? ''),
            subtitle: selectedPackage?.description || `${selectedPackage?.duration || 3} day package`,
            trailing: <span>₹{calculateTotal().toLocaleString()}</span>,
          }}
          rows={[
            {
              id: 'in',
              icon: Calendar,
              label: 'Check-in',
              primary: checkInDate ? new Date(checkInDate).toLocaleDateString() : '—',
            },
            {
              id: 'out',
              icon: Calendar,
              label: 'Check-out',
              primary: checkOutDate ? new Date(checkOutDate).toLocaleDateString() : '—',
            },
            {
              id: 'pets',
              icon: Dog,
              label: 'Pets',
              primary: selectedPets.map((p) => p.name).join(', ') || '—',
            },
            {
              id: 'guests',
              icon: Users,
              label: 'Guests',
              primary: String(guestCount),
            },
          ]}
          total={{ label: 'Total', amountFormatted: `₹${calculateTotal().toLocaleString()}` }}
          totalTextClassName="text-orange-600"
          primaryButton={{
            label: 'Continue to Payment',
            onClick: handleProceedToPayment,
            disabled: processing,
            loading: processing,
          }}
        />
        );
      })()}

      {(step !== 'payment' || showPaymentPage) && (
      <div className="px-4 py-6 max-w-md mx-auto">
        {step !== 'confirmation' && (step !== 'payment' || showPaymentPage) && renderStepIndicator()}

        {/* Package Selection */}
        {step === 'package' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Holiday Package</h2>
            <div className="space-y-3">
              {holidayPackages.map((pkg) => {
                const Icon = pkg.icon || Palmtree;
                const isSelected = selectedPackage?.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      isSelected 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        pkg.color === 'cyan' ? 'bg-cyan-100 text-cyan-600' :
                        pkg.color === 'green' ? 'bg-green-100 text-green-600' :
                        pkg.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                        <p className="text-sm text-gray-500">{pkg.description || `${pkg.duration || 3} days package`}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-500">{pkg.duration || 3} days</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">₹{pkg.price?.toLocaleString()}</p>
                        {isSelected && (
                          <CheckCircle2 className="w-6 h-6 text-orange-500 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] mt-4"
              disabled={!selectedPackage}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Date Selection */}
        {step === 'dates' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Check-in Date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.slice(0, 30).map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      setCheckInDate(d.date);
                      if (checkOutDate && d.date >= checkOutDate) {
                        setCheckOutDate('');
                      }
                    }}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      checkInDate === d.date 
                        ? 'bg-[#FF8C42] text-white' 
                        : 'bg-white border border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className="text-xs opacity-75">{d.day}</p>
                    <p className="text-xl font-bold">{d.dayNum}</p>
                    <p className="text-xs opacity-75">{d.month}</p>
                  </button>
                ))}
              </div>
            </div>

            {checkInDate && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Check-out Date</h2>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {dates.filter(d => d.date > checkInDate).slice(0, 30).map((d) => (
                    <button
                      key={d.date}
                      onClick={() => setCheckOutDate(d.date)}
                      className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                        checkOutDate === d.date 
                          ? 'bg-[#FF8C42] text-white' 
                          : 'bg-white border border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <p className="text-xs opacity-75">{d.day}</p>
                      <p className="text-xl font-bold">{d.dayNum}</p>
                      <p className="text-xs opacity-75">{d.month}</p>
                    </button>
                  ))}
                </div>
                {checkInDate && checkOutDate && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Duration: {Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))} nights
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!checkInDate || !checkOutDate}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Pet Selection */}
        {step === 'pet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Pets</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => {
                  const isSelected = selectedPets.find(p => p.id === pet.id);
                  return (
                    <button
                      key={pet.id}
                      onClick={() => togglePetSelection(pet)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isSelected 
                          ? 'border-[#FF8C42] bg-orange-50' 
                          : 'border-gray-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                        {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? (
                          <Dog className="w-7 h-7 text-orange-600" />
                        ) : pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? (
                          <Cat className="w-7 h-7 text-orange-600" />
                        ) : (
                          <User className="w-7 h-7 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                        <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-6 h-6 text-orange-500" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">No pets added yet</p>
                  <p className="text-sm text-gray-500 mb-4">Add your pet to continue with the booking</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="px-6 py-3 bg-[#FF8C42] text-white rounded-xl font-medium hover:bg-[#FF7A35] transition"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={selectedPets.length === 0}
            >
              {selectedPets.length > 0 ? `Continue (${selectedPets.length} pet${selectedPets.length > 1 ? 's' : ''})` : 'Select at least one pet'}
            </Button>
          </div>
        )}

        {/* Guest Count */}
        {step === 'guests' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Number of Guests</h2>
            
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Adults</h3>
                  <p className="text-sm text-gray-500">Including yourself</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[#FF8C42]"
                  >
                    -
                  </button>
                  <span className="text-2xl font-bold text-gray-900 w-8 text-center">{guestCount}</span>
                  <button
                    onClick={() => setGuestCount(guestCount + 1)}
                    className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[#FF8C42]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep('payment')}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
            >
              Review & continue to payment
            </Button>
          </div>
        )}

        {/* Payment */}
        {step === 'payment' && showPaymentPage && (
          <UniversalPaymentPage
            type="booking"
            serviceId={selectedPackage?.id || serviceId}
            serviceName={selectedPackage?.name || serviceName || 'Pet Holiday Package'}
            serviceDescription={`Holiday package for ${selectedPets.map(p => p.name).join(', ')}`}
            serviceStyle="at_vendor"
            category="holiday"
            vendorId={vendorId || ''}
            vendorName={holidayProvider?.name || holidayProvider?.business_name || 'Holiday Provider'}
            bookingDate={checkInDate}
            bookingTime=""
            petId={selectedPets[0]?.id}
            petName={selectedPets.map(p => p.name).join(', ')}
            petBreed={selectedPets.map(p => p.breed).join(', ')}
            baseAmount={calculateTotal()}
            priceIncludesTax={catalogPriceIncludesTax(selectedPackage)}
            duration={selectedPackage?.duration || 3}
            quantity={1}
            customerPhone={phone}
            customerId={customerId || undefined}
            onBack={() => setShowPaymentPage(false)}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Confirmation */}
        {step === 'confirmation' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 mb-6">Your holiday booking has been confirmed</p>
            
            <div className="bg-white rounded-xl p-4 mb-6 text-left">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500">Booking ID</p>
                <p className="font-mono font-bold text-lg">{bookingId}</p>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-500">Package</span>
                  <span className="font-medium">{selectedPackage?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Check-in</span>
                  <span className="font-medium">{checkInDate ? new Date(checkInDate).toLocaleDateString() : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Check-out</span>
                  <span className="font-medium">{checkOutDate ? new Date(checkOutDate).toLocaleDateString() : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pets</span>
                  <span className="font-medium">{selectedPets.map(p => p.name).join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => onViewBooking?.(bookingId || '')}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              >
                View Booking Details
              </Button>
              <Button 
                onClick={onBack}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Add Pet Modal */}
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={() => setShowAddPetModal(false)}
          onSuccess={() => {
            refreshPets();
            setShowAddPetModal(false);
          }}
        />
      </div>
      )}
    </>
  );
}
