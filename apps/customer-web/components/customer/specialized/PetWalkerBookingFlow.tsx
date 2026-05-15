'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { MapPin, Clock, Calendar, Route, Star } from 'lucide-react';
import { PrePaymentBookingReview } from '../booking/PrePaymentBookingReview';

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
  const [showPreReview, setShowPreReview] = useState(false);

  const walkTypeLabel =
    walkType === 'long' ? 'Long walk' : walkType === 'exercise' ? 'Exercise walk' : 'Regular walk';

  const walkerPrePaymentStats = [
    { value: '5★', label: 'Walks', icon: <Star className="w-4 h-4 fill-white" /> },
    { value: '30+', label: 'Min' },
    { value: '1+', label: 'Pets' },
  ];

  const calculatePrice = (): number => {
    const basePrice = 200;
    const durationMultiplier = duration / 30; // Base is 30 min
    const typeMultiplier = walkType === 'long' ? 1.5 : walkType === 'exercise' ? 1.3 : 1;
    const petMultiplier = petCount > 1 ? 1 + (petCount - 1) * 0.5 : 1;
    
    return Math.round(basePrice * durationMultiplier * typeMultiplier * petMultiplier);
  };

  const validate = (): boolean => {
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return false;
    }
    if (!pickupAddress.trim()) {
      setError('Pickup address is required');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setProcessing(true);
    setError(null);

    try {
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;

      if (!customerId) {
        throw new Error('Customer not found');
      }

      // CreateBookingRequestSchema requires serviceId (UUID). Fetch vendor's walker service when possible.
      let serviceIdValue: string | undefined;
      try {
        const servicesRes = await apiClient.get<any>(`/customer/vendor/${vendorId}/services`) as any;
        const services =
          Array.isArray(servicesRes?.services) || Array.isArray(servicesRes?.packages)
            ? mergeCustomerVendorServicesPayload(servicesRes)
            : servicesRes?.data ?? [];
        const walkerService = Array.isArray(services) && services.find((s: any) => (s.service_type || s.serviceType || s.category || '').toLowerCase().includes('walk'));
        serviceIdValue = walkerService?.id ?? walkerService?.serviceId ?? walkerService?.service_id ?? (services[0]?.id ?? services[0]?.serviceId ?? services[0]?.service_id);
      } catch (_) {
        /* ignore */
      }
      if (!serviceIdValue) {
        setError('No walker service found for this vendor. Please book from the Walker service page.');
        setProcessing(false);
        return;
      }

      const bookingData = {
        customerId,
        vendorId,
        serviceId: serviceIdValue,
        serviceType: 'at_home',
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        address: pickupAddress,
        amount: calculatePrice(),
        notes: JSON.stringify({
          walkType,
          duration,
          petCount,
          specialInstructions,
        }),
      };

      const bookingResponse = await apiClient.post<any>('/bookings/create', bookingData);
      const bid = bookingResponse?.data?.bookingId ?? bookingResponse?.bookingId ?? bookingResponse?.booking?.id ?? bookingResponse?.id;
      if (bid) {
        if (onSuccess) onSuccess(bid);
      } else {
        throw new Error(bookingResponse?.error || bookingResponse?.data?.error || 'Failed to create booking');
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to book walker');
    } finally {
      setProcessing(false);
    }
  };

  if (showPreReview) {
    return (
      <div className="min-h-0">
        {error && (
          <div className="px-4 pt-2 max-w-md mx-auto">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-2">{error}</div>
          </div>
        )}
        <PrePaymentBookingReview
          title="Booking Summary"
          subtitle="Review before confirming"
          headerIcon={Route}
          stats={walkerPrePaymentStats}
          onBack={() => {
            setShowPreReview(false);
            setError(null);
          }}
          lead={{
            icon: Route,
            iconContainerClassName: 'bg-orange-100 text-[#FF8C42]',
            title: 'Pet walk',
            subtitle: `${walkTypeLabel} · ${duration} min · ${petCount} pet${petCount > 1 ? 's' : ''}`,
            trailing: <span>₹{calculatePrice()}</span>,
          }}
          rows={[
            {
              id: 'dt',
              icon: Calendar,
              label: 'Date & time',
              primary: selectedDate
                ? `${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })} at ${selectedTime}`
                : '—',
            },
            {
              id: 'addr',
              icon: MapPin,
              label: 'Pickup address',
              primary: pickupAddress,
            },
          ]}
          notes={{
            value: specialInstructions,
            onChange: setSpecialInstructions,
            placeholder: 'Any special requirements, pet behavior notes, or route preferences...',
            showNotes: true,
            label: 'Special instructions (optional)',
          }}
          total={{ label: 'Total', amountFormatted: `₹${calculatePrice()}` }}
          totalTextClassName="text-orange-600"
          primaryButton={{
            label: `Book walk – ₹${calculatePrice()}`,
            onClick: handleSubmit,
            disabled: processing,
            loading: processing,
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-0 flex items-center gap-3">
        <Route className="text-orange-500" size={28} />
        Book Pet Walker
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (validate()) setShowPreReview(true);
        }}
        className="space-y-6"
      >
        {/* Date and Time */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Schedule Walk</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Calendar className="inline mr-2" size={16} />
                Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Clock className="inline mr-2" size={16} />
                Time *
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Walk Details */}
        <div className="bg-white rounded-xl p-0 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Walk Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Walk Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['regular', 'long', 'exercise'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWalkType(type)}
                  className={`px-4 py-0 rounded-lg border-2 transition ${
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
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Duration (minutes) *
            </label>
            <select
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDuration(parseInt(e.target.value))}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Number of Pets *
            </label>
            <input
              type="number"
              min="1"
              value={petCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPetCount(parseInt(e.target.value) || 1)}
              required
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Pickup Address */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-0">
            <MapPin className="inline mr-2" size={16} />
            Pickup Address *
          </label>
          <textarea
            value={pickupAddress}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPickupAddress(e.target.value)}
            required
            rows={3}
            placeholder="Enter address where walker should pick up your pet"
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Special Instructions
          </label>
          <textarea
            value={specialInstructions}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialInstructions(e.target.value)}
            rows={3}
            placeholder="Any special requirements, pet behavior notes, or route preferences..."
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
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
              className="flex-1 px-0 py-0 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || !pickupAddress}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : `Review & book – ₹${calculatePrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

