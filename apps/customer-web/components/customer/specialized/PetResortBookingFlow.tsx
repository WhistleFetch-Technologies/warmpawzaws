'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Home, Calendar, Users, Bed } from 'lucide-react';

interface PetResortBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  capacity: number;
  amenities: string[];
  price_per_night: number;
  is_available: boolean;
}

export function PetResortBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: PetResortBookingFlowProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Booking details
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [petCount, setPetCount] = useState(1);
  const [petDetails, setPetDetails] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      loadAvailableRooms();
    }
  }, [vendorId, checkInDate, checkOutDate, petCount]);

  const loadAvailableRooms = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/resort/rooms`);
      
      if (response.success && response.rooms) {
        const available = response.rooms.filter((r: Room) => r.is_available && r.capacity >= petCount);
        setRooms(available);
        
        if (available.length > 0 && !selectedRoom) {
          setSelectedRoom(available[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading rooms:', err);
      setError('Failed to load available rooms');
    } finally {
      setLoading(false);
    }
  };

  const calculateNights = (): number => {
    if (!checkInDate || !checkOutDate) return 0;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diffTime = checkOut.getTime() - checkIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculatePrice = (): number => {
    const room = rooms.find(r => r.id === selectedRoom);
    if (!room) return 0;

    const nights = calculateNights();
    return room.price_per_night * nights;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoom) {
      setError('Please select a room');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      setError('Please select check-in and check-out dates');
      return;
    }

    const nights = calculateNights();
    if (nights <= 0) {
      setError('Check-out date must be after check-in date');
      return;
    }

    if (petCount < 1) {
      setError('Number of pets must be at least 1');
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

      const room = rooms.find(r => r.id === selectedRoom);
      const nights = calculateNights();
      
      const bookingData = {
        serviceId: 'pet_resort',
        vendorId,
        customerId,
        serviceType: 'at_center',
        bookingType: 'scheduled',
        bookingDate: checkInDate,
        bookingTime: '10:00', // Default check-in time
        notes: JSON.stringify({
          roomId: selectedRoom,
          roomNumber: room?.room_number,
          checkInDate,
          checkOutDate,
          nights,
          petCount,
          petDetails,
          specialRequests,
        }),
        totalAmount: calculatePrice(),
      };

      const bookingResponse = await apiClient.post<any>('/bookings/create', bookingData);

      if (!bookingResponse.success || !bookingResponse.booking) {
        throw new Error(bookingResponse.error || 'Failed to create booking');
      }

      const bookingId = bookingResponse.booking.id || bookingResponse.booking_id;
      const totalAmount = calculatePrice();

      // Handle payment if amount > 0
      if (totalAmount > 0) {
        try {
          // Create Razorpay order
          const orderRes = await apiClient.post<any>('/payments/create-order', {
            booking_id: bookingId,
            amount: totalAmount,
          });

          if (!orderRes.order_id) {
            throw new Error('Failed to create payment order');
          }

          // Load Razorpay script if not loaded
          if (!window.Razorpay) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
            await new Promise((resolve) => {
              script.onload = resolve;
            });
          }

          // Open Razorpay checkout
          const options = {
            key: orderRes.razorpay_key || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
            amount: totalAmount * 100,
            currency: 'INR',
            name: 'Warmpawz',
            description: `Pet Resort Booking - ${nights} night${nights > 1 ? 's' : ''} stay`,
            order_id: orderRes.order_id,
            handler: async (response: any) => {
              try {
                // Verify payment
                await apiClient.post('/payments/verify', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  booking_id: bookingId,
                });
                
                if (onSuccess) {
                  onSuccess(bookingId);
                }
              } catch (err: any) {
                console.error('Payment verification failed:', err);
                setError('Payment verification failed. Please contact support.');
              }
            },
            prefill: {
              contact: customerPhone,
            },
            theme: {
              color: '#FF8C42',
            },
            modal: {
              ondismiss: () => {
                setProcessing(false);
              },
            },
          };

          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
        } catch (paymentErr: any) {
          console.error('Payment error:', paymentErr);
          setError(paymentErr.message || 'Payment failed. Please try again.');
          setProcessing(false);
        }
      } else {
        // Free booking - no payment needed
        if (onSuccess) {
          onSuccess(bookingId);
        }
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to book room');
    } finally {
      setProcessing(false);
    }
  };

  const nights = calculateNights();

  return (
    <div className="max-w-2xl mx-auto p-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-0 flex items-center gap-3">
        <Home className="text-orange-500" size={28} />
        Book Pet Resort Stay
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dates */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Stay Dates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Calendar className="inline mr-2" size={16} />
                Check-in Date *
              </label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckInDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Check-out Date *
              </label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckOutDate(e.target.value)}
                min={checkInDate || new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          {nights > 0 && (
            <div className="mt-4 p-0 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>{nights}</strong> night{nights > 1 ? 's' : ''} stay
              </p>
            </div>
          )}
        </div>

        {/* Pet Details */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Pet Details</h3>
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
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Pet Information
            </label>
            <textarea
              value={petDetails}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPetDetails(e.target.value)}
              rows={3}
              placeholder="Pet names, breeds, ages, special needs..."
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Room Selection */}
        {checkInDate && checkOutDate && nights > 0 ? (
          loading ? (
            <div className="flex items-center justify-center p-02">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : rooms.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">Select Room</h3>
              </div>
              <div className="divide-y">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoom(room.id)}
                    className={`w-full p-4 text-left transition ${
                      selectedRoom === room.id
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <Bed className="text-orange-500" size={18} />
                          <span className="font-semibold text-gray-900">
                            Room {room.room_number}
                          </span>
                          <span className="px-0 py-0 bg-blue-100 text-blue-700 rounded text-xs">
                            {room.room_type}
                          </span>
                        </div>
                        <div className="mt-0 flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-3">
                            <Users size={14} />
                            Capacity: {room.capacity} pet{room.capacity > 1 ? 's' : ''}
                          </span>
                          {room.amenities && room.amenities.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {room.amenities.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-orange-600">
                          ₹{room.price_per_night}/night
                        </p>
                        {selectedRoom === room.id && nights > 0 && (
                          <p className="text-sm text-gray-500">
                            Total: ₹{calculatePrice()}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              No rooms available for the selected dates
            </div>
          )
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-center">
            Please select check-in and check-out dates to view available rooms
          </div>
        )}

        {/* Special Requests */}
        <div className="bg-white rounded-xl p-1 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Special Requests
          </label>
          <textarea
            value={specialRequests}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialRequests(e.target.value)}
            rows={3}
            placeholder="Dietary requirements, medication schedules, special care needs..."
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Price Summary */}
        {selectedRoom && nights > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Booking Summary</p>
                <p className="text-sm text-gray-600 mt-0">
                  {nights} night{nights > 1 ? 's' : ''} • {petCount} pet{petCount > 1 ? 's' : ''}
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-600">₹{calculatePrice()}</p>
            </div>
          </div>
        )}

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
            disabled={processing || !selectedRoom || nights <= 0}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : `Book Stay - ₹${calculatePrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

