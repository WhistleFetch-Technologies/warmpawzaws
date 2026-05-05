'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { Coffee, Users, Calendar, Clock, Star } from 'lucide-react';
import { PrePaymentBookingReview } from '../booking/PrePaymentBookingReview';

interface PetCafeBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  table_type: string;
  amenities: string[];
  is_available: boolean;
  price_per_hour?: number;
}

export function PetCafeBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: PetCafeBookingFlowProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Booking details
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(1); // hours
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [petCount, setPetCount] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [showPreReview, setShowPreReview] = useState(false);

  const cafePrePaymentStats = [
    { value: '—', label: 'Café', icon: <Star className="w-4 h-4 fill-white" /> },
    { value: '1h+', label: 'Stays' },
    { value: 'Pet', label: 'OK' },
  ];

  useEffect(() => {
    loadTables();
  }, [vendorId, selectedDate, selectedTime]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/tables`);
      
      if (response.success && response.tables) {
        // Filter available tables based on date/time
        const available = response.tables.filter((t: Table) => t.is_available);
        setTables(available);
        
        if (available.length > 0 && !selectedTable) {
          // Auto-select first table that fits capacity
          const suitableTable = available.find((t: Table) => t.capacity >= numberOfGuests) || available[0];
          setSelectedTable(suitableTable.id);
        }
      }
    } catch (err: any) {
      console.error('Error loading tables:', err);
      setError('Failed to load available tables');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (): number => {
    const table = tables.find(t => t.id === selectedTable);
    if (!table) return 0;

    const basePrice = table.price_per_hour || 200;
    return basePrice * duration;
  };

  const validate = (): boolean => {
    if (!selectedTable) {
      setError('Please select a table');
      return false;
    }
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return false;
    }
    if (numberOfGuests < 1) {
      setError('Number of guests must be at least 1');
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

      const table = tables.find(t => t.id === selectedTable);
      
      const bookingData = {
        serviceId: 'pet_cafe',
        vendorId,
        customerId,
        serviceType: 'at_center',
        bookingType: 'scheduled',
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        notes: JSON.stringify({
          tableId: selectedTable,
          tableNumber: table?.table_number,
          duration,
          numberOfGuests,
          petCount,
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

          const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
          const options = buildSanitizedStandardRazorpayCheckoutOptions({
            key: (orderRes.razorpay_key || process.env.NEXT_PUBLIC_RAZORPAY_KEY) as string,
            amountPaise: Math.max(1, Math.round(Number(totalAmount) * 100)),
            currency: 'INR',
            name: 'Warmpawz',
            description: `Pet Cafe Table Booking - Table ${table?.table_number}`,
            order_id: orderRes.order_id,
            customerPhone,
            customerEmail: checkoutEmail,
            includeInstrumentBlocks: true,
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
            theme: {
              color: '#FF8C42',
            },
            modal: {
              ondismiss: () => {
                setProcessing(false);
              },
            },
          });

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
      setError(err.message || 'Failed to book table');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-02">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const activeTable = tables.find((t) => t.id === selectedTable);

  if (showPreReview && activeTable) {
    return (
      <div className="min-h-0">
        {error && (
          <div className="px-4 pt-2 max-w-md mx-auto">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-2">{error}</div>
          </div>
        )}
        <PrePaymentBookingReview
          title="Booking Summary"
          subtitle="Review before payment"
          headerIcon={Coffee}
          stats={cafePrePaymentStats}
          onBack={() => {
            setShowPreReview(false);
            setError(null);
          }}
          lead={{
            icon: Coffee,
            iconContainerClassName: 'bg-orange-100 text-[#FF8C42]',
            title: `Table ${activeTable.table_number}`,
            subtitle: `${activeTable.table_type} · up to ${activeTable.capacity} guests`,
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
              id: 'dur',
              icon: Clock,
              label: 'Duration',
              primary: `${duration} hour${duration > 1 ? 's' : ''}`,
            },
            {
              id: 'guests',
              icon: Users,
              label: 'Guests & pets',
              primary: `${numberOfGuests} guest${numberOfGuests > 1 ? 's' : ''} · ${petCount} pet${petCount > 1 ? 's' : ''}`,
            },
          ]}
          notes={{
            value: specialRequests,
            onChange: setSpecialRequests,
            placeholder: 'Any special requirements or requests...',
            showNotes: true,
            label: 'Special requests (optional)',
          }}
          total={{ label: 'Total', amountFormatted: `₹${calculatePrice()}` }}
          totalTextClassName="text-orange-600"
          primaryButton={{
            label: `Book table – ₹${calculatePrice()}`,
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
        <Coffee className="text-orange-500" size={28} />
        Book Pet Cafe Table
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
          <h3 className="font-semibold text-gray-900 mb-4">Select Date & Time</h3>
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

        {/* Guest Details */}
        <div className="bg-white rounded-xl p-0 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Guest Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Users className="inline mr-2" size={16} />
                Number of Guests *
              </label>
              <input
                type="number"
                min="1"
                value={numberOfGuests}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumberOfGuests(parseInt(e.target.value) || 1)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
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
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Duration (hours) *
            </label>
            <select
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDuration(parseInt(e.target.value))}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {[1, 2, 3, 4, 5, 6].map(h => (
                <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Selection */}
        {tables.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Select Table</h3>
            </div>
            <div className="divide-y">
              {tables
                .filter(t => t.capacity >= numberOfGuests)
                .map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => setSelectedTable(table.id)}
                    className={`w-full p-4 text-left transition ${
                      selectedTable === table.id
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            Table {table.table_number}
                          </span>
                          <span className="px-0 py-0 bg-blue-100 text-blue-700 rounded text-xs">
                            {table.table_type}
                          </span>
                        </div>
                        <div className="mt-0 flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-3">
                            <Users size={14} />
                            Capacity: {table.capacity}
                          </span>
                          {table.amenities && table.amenities.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {table.amenities.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          ₹{calculatePrice()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {table.price_per_hour || 200}/hour
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
            {tables.filter(t => t.capacity >= numberOfGuests).length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No tables available for {numberOfGuests} guests
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
            No tables available at the moment
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
            placeholder="Any special requirements or requests..."
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
            disabled={processing || !selectedTable}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : `Review & book – ₹${calculatePrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

