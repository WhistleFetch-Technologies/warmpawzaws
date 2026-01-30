'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, Check } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { CalendarSlotPicker } from './CalendarSlotPicker';

interface CenterBookingPageProps {
  phone: string;
  serviceId: string;
  vendorId: string;
  petId?: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function CenterBookingPage({
  phone,
  serviceId,
  vendorId,
  petId,
  onBack,
  onSuccess
}: CenterBookingPageProps) {
  const [loading, setLoading] = useState(false);
  const [loadingPets, setLoadingPets] = useState(true);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>(petId || '');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  useEffect(() => {
    fetchPets();
  }, [phone]);

  useEffect(() => {
    if (selectedDate && vendorId) {
      fetchAvailableSlots();
    }
  }, [selectedDate, vendorId]);

  const fetchPets = async () => {
    try {
      setLoadingPets(true);
      const response = await apiClient.get<{ pets: any[] }>(`/customer/pets?phone=${encodeURIComponent(phone)}`);
      if (response.pets) {
        setPets(response.pets);
        if (petId && response.pets.find(p => p.id === petId)) {
          setSelectedPetId(petId);
        }
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoadingPets(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      const response = await apiClient.get<{ slots: any[] }>(
        `/vendor/${vendorId}/available-slots?date=${selectedDate}`
      );
      if (response.slots) {
        setAvailableSlots(response.slots);
      }
    } catch (err) {
      console.error('Error fetching available slots:', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPetId || !selectedDate || !selectedTimeSlot) {
      alert('Please select pet, date, and time slot');
      return;
    }

    setLoading(true);
    try {
      const customerRes = await apiClient.get<{ customer?: { id: string }; id?: string }>(`/customer/by-phone?phone=${encodeURIComponent(phone)}`);
      const customerId = customerRes?.customer?.id ?? customerRes?.id;
      if (!customerId) {
        alert('Customer not found. Please try again.');
        setLoading(false);
        return;
      }
      const response = await apiClient.post<{ bookingId?: string; data?: { bookingId?: string }; booking?: { id?: string } }>('/booking/create', {
        customerId,
        vendorId,
        serviceId,
        bookingDate: selectedDate,
        bookingTime: selectedTimeSlot.includes(':') ? selectedTimeSlot.split(':').slice(0, 2).join(':') : selectedTimeSlot,
        serviceType: 'at_center',
        petId: selectedPetId,
        customerPhone: phone,
      });

      const bookingId = response?.data?.bookingId ?? response?.bookingId ?? response?.booking?.id;
      if (bookingId) {
        alert('Booking created successfully!');
        onSuccess(bookingId);
      } else {
        alert('Booking created but no booking ID returned.');
      }
    } catch (err) {
      console.error('Error creating booking:', err);
      alert('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Center Booking</h1>
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Pet Selection */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Select Pet</h3>
          {loadingPets ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPetId(pet.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedPetId === pet.id
                      ? 'border-primary bg-orange-50'
                      : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {pet.profilePhoto ? (
                      <img
                        src={pet.profilePhoto}
                        alt={pet.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-bold">
                        {pet.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{pet.name}</h4>
                      <p className="text-sm text-gray-600">{pet.breed}</p>
                    </div>
                    {selectedPetId === pet.id && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Calendar & Time Slot Picker */}
        <CalendarSlotPicker
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTimeSlotSelect={setSelectedTimeSlot}
          availableSlots={availableSlots}
        />

        {/* Confirm Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !selectedPetId || !selectedDate || !selectedTimeSlot}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}

