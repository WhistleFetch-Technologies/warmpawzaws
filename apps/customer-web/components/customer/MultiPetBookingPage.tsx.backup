'use client';

import React, { useState, useEffect } from 'react';
import { Check, Calendar, Clock, MapPin, User, DollarSign, Percent, Info, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
      const response = await apiClient.get<{ pets: Pet[] }>(`/customer/${customerId}/pets`);
      if (response.pets) {
        setPets(response.pets);
      }
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

  const handleConfirmBooking = async () => {
    if (selectedPetIds.length === 0) {
      alert('Please select at least one pet');
      return;
    }

    setBooking(true);
    try {
      const pricing = calculatePricing();
      
      const response = await apiClient.post<{ bookingId: string }>('/booking/multi-pet', {
        customerId,
        customerPhone,
        serviceId: service.id,
        vendorId: service.vendorId,
        petIds: selectedPetIds,
        scheduledDate,
        scheduledTime,
        location,
        pricing
      });

      if (response.bookingId) {
        alert('Multi-pet booking created successfully!');
        onSuccess?.(response.bookingId);
      }
    } catch (err) {
      console.error('Error creating booking:', err);
      alert('Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  const pricing = calculatePricing();

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Multi-Pet Booking</h1>
            <p className="text-white/90 text-sm">{service.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Service Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Service Details</h3>
            <span className="text-sm text-gray-600">{service.vendorName}</span>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(scheduledDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{scheduledTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>₹{service.price} per pet</span>
            </div>
          </div>
        </div>

        {/* Pet Selection */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Select Pets</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : pets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No pets found. Please add a pet first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pets.map((pet) => {
                const isSelected = selectedPetIds.includes(pet.id);
                return (
                  <button
                    key={pet.id}
                    onClick={() => togglePetSelection(pet.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-orange-50'
                        : 'border-gray-200 hover:border-primary'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {pet.profilePhoto ? (
                        <img
                          src={pet.profilePhoto}
                          alt={pet.name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white text-xl font-bold">
                          {pet.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{pet.name}</h4>
                        <p className="text-sm text-gray-600">{pet.breed} • {pet.age} years</p>
                      </div>
                      {isSelected && (
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pricing Breakdown */}
        {selectedPetIds.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Pricing Breakdown</h3>
            <div className="space-y-3">
              {pricing.breakdown.map((item) => (
                <div key={item.petId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-900">{item.petName}</p>
                    {!item.isFirstPet && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        20% discount applied
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {item.isFirstPet ? (
                      <p className="font-semibold text-gray-900">₹{item.basePrice}</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 line-through">₹{item.basePrice}</p>
                        <p className="font-semibold text-primary">₹{item.finalPrice}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t-2 border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">₹{pricing.basePrice}</span>
                </div>
                {pricing.discount > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-600 flex items-center gap-1">
                      <Percent className="w-4 h-4" />
                      Discount ({(pricing.numberOfPets || 0) - 1} additional pet{(pricing.numberOfPets || 0) > 2 ? 's' : ''})
                    </span>
                    <span className="font-semibold text-green-600">-₹{pricing.discount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-primary">₹{pricing.totalPrice}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner */}
        {selectedPetIds.length > 1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Multi-Pet Discount</p>
                <p className="text-sm text-blue-700">
                  You're saving ₹{pricing.discount} with our 20% discount on additional pets!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirmBooking}
          disabled={booking || selectedPetIds.length === 0}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {booking ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Creating Booking...
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
  );
}

