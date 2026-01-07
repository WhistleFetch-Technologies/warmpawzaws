'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { MapPin, Clock, Calendar, Route } from 'lucide-react';

interface PetWalkerBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

export function PetWalkerBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: PetWalkerBookingFlowProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Booking details
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(30); // minutes
  const [walkType, setWalkType] = useState<'regular' | 'long' | 'exercise'>('regular');
  const [pickupAddress, setPickupAddress] = useState('');
  const [petCount, setPetCount] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const calculatePrice = (): number => {
    const basePrice = 200;
    const durationMultiplier = duration / 30; // Base is 30 min
    const typeMultiplier = walkType === 'long' ? 1.5 : walkType === 'exercise' ? 1.3 : 1;
    const petMultiplier = petCount > 1 ? 1 + (petCount - 1) * 0.5 : 1;
    
    return Math.round(basePrice * durationMultiplier * typeMultiplier * petMultiplier);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }

    if (!pickupAddress.trim()) {
      setError('Pickup address is required');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;

      if (!customerId) {
        throw new Error('Customer not found');
      }

      const bookingData = {
        serviceId: 'pet_walker',
        vendorId,
        customerId,
        serviceType: 'at_home',
        bookingType: 'scheduled',
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        address: pickupAddress,
        notes: JSON.stringify({
          walkType,
          duration,
          petCount,
          specialInstructions,
        }),
        totalAmount: calculatePrice(),
      };

      const bookingResponse = await apiClient.post<any>('/bookings/create', bookingData);

      if (bookingResponse.success && bookingResponse.booking) {
        if (onSuccess) {
          onSuccess(bookingResponse.booking.id);
        }
      } else {
        throw new Error(bookingResponse.error || 'Failed to create booking');
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to book walker');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Route className="text-orange-500" size={28} />
        Book Pet Walker
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date and Time */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Schedule Walk</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline mr-1" size={16} />
                Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline mr-1" size={16} />
                Time *
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Walk Details */}
        <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Walk Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Walk Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['regular', 'long', 'exercise'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWalkType(type)}
                  className={`px-4 py-3 rounded-lg border-2 transition ${
                    walkType === type
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes) *
            </label>
            <select
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDuration(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Pets *
            </label>
            <input
              type="number"
              min="1"
              value={petCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPetCount(parseInt(e.target.value) || 1)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Pickup Address */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline mr-1" size={16} />
            Pickup Address *
          </label>
          <textarea
            value={pickupAddress}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPickupAddress(e.target.value)}
            required
            rows={3}
            placeholder="Enter address where walker should pick up your pet"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Instructions
          </label>
          <textarea
            value={specialInstructions}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialInstructions(e.target.value)}
            rows={3}
            placeholder="Any special requirements, pet behavior notes, or route preferences..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Price Summary */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Booking Summary</p>
              <p className="text-sm text-gray-600 mt-1">
                {duration} min {walkType} walk • {petCount} pet{petCount > 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-2xl font-bold text-orange-600">₹{calculatePrice()}</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || !pickupAddress}
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : `Book Walk - ₹${calculatePrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

