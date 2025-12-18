/**
 * MULTI-PET BOOKING PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Select multiple pets for same service
 * - Automatic 20% discount on additional pets
 * - Unified pricing calculation
 * - Parent-child booking structure
 * - Pet validation
 * 
 * Status: ✅ P0 IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Check, Calendar, Clock, MapPin, User, DollarSign, Percent, Info, ChevronRight } from 'lucide-react';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: number;
  weight?: number;
  profilePhoto?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  vendorName: string;
  vendorId: string;
  serviceStyle: string;
}

interface MultiPetBookingPageProps {
  customerId: string;
  customerPhone: string;
  service: Service;
  scheduledDate: string;
  scheduledTime: string;
  location?: any;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

export function MultiPetBookingPage({
  customerId,
  customerPhone,
  service,
  scheduledDate,
  scheduledTime,
  location,
  onSuccess,
  onCancel
}: MultiPetBookingPageProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ADDITIONAL_PET_DISCOUNT = 0.20; // 20% discount

  useEffect(() => {
    loadPets();
  }, [customerId]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/pets`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load pets');
      }

      const data = await response.json();
      setPets(data.pets || []);
    } catch (err) {
      console.error('Error loading pets:', err);
      setError('Failed to load your pets');
    } finally {
      setLoading(false);
    }
  };

  const togglePetSelection = (petId: string) => {
    setSelectedPetIds(prev => {
      if (prev.includes(petId)) {
        return prev.filter(id => id !== petId);
      } else {
        return [...prev, petId];
      }
    });
  };

  const calculatePricing = () => {
    const numberOfPets = selectedPetIds.length;
    if (numberOfPets === 0) {
      return {
        basePrice: 0,
        discount: 0,
        totalPrice: 0,
        pricePerPet: 0,
        breakdown: []
      };
    }

    const breakdown: any[] = [];
    let totalBeforeDiscount = 0;
    let totalDiscount = 0;

    selectedPetIds.forEach((petId, index) => {
      const pet = pets.find(p => p.id === petId);
      const isFirstPet = index === 0;
      const basePrice = service.price;
      const discount = isFirstPet ? 0 : basePrice * ADDITIONAL_PET_DISCOUNT;
      const finalPrice = basePrice - discount;

      totalBeforeDiscount += basePrice;
      totalDiscount += discount;

      breakdown.push({
        petId,
        petName: pet?.name || 'Unknown',
        basePrice,
        discount,
        finalPrice,
        isFirstPet
      });
    });

    return {
      basePrice: totalBeforeDiscount,
      discount: totalDiscount,
      totalPrice: totalBeforeDiscount - totalDiscount,
      pricePerPet: service.price,
      breakdown,
      numberOfPets
    };
  };

  const createMultiPetBooking = async () => {
    if (selectedPetIds.length === 0) {
      setError('Please select at least one pet');
      return;
    }

    try {
      setBooking(true);
      setError(null);

      const pricing = calculatePricing();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/create-multi-pet`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId,
            customerPhone,
            petIds: selectedPetIds,
            vendorId: service.vendorId,
            serviceId: service.id,
            serviceName: service.name,
            vendorName: service.vendorName,
            serviceStyle: service.serviceStyle,
            scheduledDate,
            scheduledTime,
            location,
            basePrice: service.price,
            totalAmount: pricing.totalPrice,
            discount: pricing.discount
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const data = await response.json();
      
      // Success!
      alert(`✅ Multi-pet booking created successfully!\n\nBooking ID: ${data.parentBookingId}\nTotal: ₹${pricing.totalPrice}\nSaved: ₹${pricing.discount}`);
      
      if (onSuccess) {
        onSuccess(data.parentBookingId);
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  const pricing = calculatePricing();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Book for Multiple Pets</h1>
        <p className="text-sm text-gray-600">
          Select multiple pets and get 20% off on additional pets!
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Service Details */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="w-4 h-4 text-gray-400" />
            <span>{service.name}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>{service.vendorName}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{new Date(scheduledDate).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{scheduledTime}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span>₹{service.price} per pet</span>
          </div>
        </div>
      </div>

      {/* Discount Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 shadow-sm mb-6 text-white">
        <div className="flex items-start gap-3">
          <Percent className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-1">Multi-Pet Discount Active!</div>
            <div className="text-sm opacity-90">
              Get 20% off on each additional pet. The more pets, the more you save!
            </div>
          </div>
        </div>
      </div>

      {/* Pet Selection */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Select Pets</h3>
        
        {pets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No pets found. Please add a pet first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pets.map((pet) => {
              const isSelected = selectedPetIds.includes(pet.id);
              const isFirstSelected = selectedPetIds[0] === pet.id;
              
              return (
                <button
                  key={pet.id}
                  onClick={() => togglePetSelection(pet.id)}
                  className={`w-full border-2 rounded-xl p-4 transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    {pet.profilePhoto && (
                      <img 
                        src={pet.profilePhoto} 
                        alt={pet.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}

                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {pet.name}
                        {isSelected && isFirstSelected && (
                          <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                            Full Price
                          </span>
                        )}
                        {isSelected && !isFirstSelected && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                            20% Off
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {pet.type} • {pet.breed} • {pet.age} {pet.age === 1 ? 'year' : 'years'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-semibold ${
                        isSelected && !isFirstSelected ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        ₹{isFirstSelected || !isSelected 
                          ? service.price 
                          : (service.price * (1 - ADDITIONAL_PET_DISCOUNT)).toFixed(0)
                        }
                      </div>
                      {isSelected && !isFirstSelected && (
                        <div className="text-xs text-gray-500 line-through">
                          ₹{service.price}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pricing Breakdown */}
      {selectedPetIds.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Pricing Breakdown</h3>
          
          <div className="space-y-3 mb-4">
            {pricing.breakdown.map((item: any, index: number) => (
              <div key={item.petId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    item.isFirstPet ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-gray-700">{item.petName}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">₹{item.finalPrice.toFixed(0)}</div>
                  {item.discount > 0 && (
                    <div className="text-xs text-green-600">-₹{item.discount.toFixed(0)} saved</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Subtotal ({pricing.numberOfPets} pets)</span>
              <span>₹{pricing.basePrice.toFixed(0)}</span>
            </div>
            
            {pricing.discount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Multi-Pet Discount
                </span>
                <span>-₹{pricing.discount.toFixed(0)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Amount</span>
              <span className="text-orange-600">₹{pricing.totalPrice.toFixed(0)}</span>
            </div>

            {pricing.discount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>You're saving ₹{pricing.discount.toFixed(0)} with multi-pet booking!</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          {selectedPetIds.length > 0 && (
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-gray-600">
                {selectedPetIds.length} {selectedPetIds.length === 1 ? 'pet' : 'pets'} selected
              </span>
              <span className="font-bold text-orange-600">₹{pricing.totalPrice.toFixed(0)}</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCancel}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createMultiPetBooking}
              disabled={selectedPetIds.length === 0 || booking}
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {booking ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Booking...
                </>
              ) : (
                <>
                  Confirm Booking
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiPetBookingPage;
