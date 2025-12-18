import React, { useState } from 'react';
import { Calendar, MapPin, User, DollarSign, Check } from 'lucide-react';
import { CouponCodeInput, DiscountSummary } from './CouponCodeInput';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

/**
 * 🛒 BOOKING WITH COUPON INTEGRATION
 * 
 * Complete booking flow with coupon application
 * - Service selection
 * - Date/time selection
 * - Coupon application
 * - Price calculation with discount
 * - Payment integration
 */

interface BookingWithCouponProps {
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
  vendor: {
    id: string;
    name: string;
    location: string;
  };
  customerId: string;
  onBookingComplete?: (bookingId: string) => void;
}

export function BookingWithCoupon({
  service,
  vendor,
  customerId,
  onBookingComplete
}: BookingWithCouponProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [petId, setPetId] = useState('');
  
  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate amounts
  const originalAmount = service.price;
  const finalAmount = originalAmount - discountAmount;

  const handleCouponApplied = (discount: number, coupon: any) => {
    setAppliedCoupon(coupon);
    setDiscountAmount(discount);
    setError(null);
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
  };

  const handleBooking = async () => {
    // Validation
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }

    if (!petId) {
      setError('Please select a pet');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Create booking
      const bookingResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId,
            vendorId: vendor.id,
            serviceId: service.id,
            petId,
            date: selectedDate,
            time: selectedTime,
            price: finalAmount, // Use discounted price
            originalPrice: originalAmount,
            discount: discountAmount,
            couponCode: appliedCoupon?.code
          })
        }
      );

      const bookingData = await bookingResponse.json();

      if (!bookingData.success) {
        throw new Error(bookingData.error || 'Failed to create booking');
      }

      const bookingId = bookingData.booking.id;

      // Step 2: Apply coupon if one was used
      if (appliedCoupon) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/coupons/apply`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              code: appliedCoupon.code,
              orderAmount: originalAmount,
              customerId,
              bookingId,
              discountAmount
            })
          }
        );
      }

      // Step 3: Initiate payment
      const paymentResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/payment/initiate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId,
            amount: finalAmount,
            customerId,
            metadata: {
              originalAmount,
              discount: discountAmount,
              couponCode: appliedCoupon?.code
            }
          })
        }
      );

      const paymentData = await paymentResponse.json();

      if (paymentData.success) {
        setSuccess(true);
        
        if (onBookingComplete) {
          onBookingComplete(bookingId);
        }

        // In a real app, redirect to payment gateway here
        console.log('Payment initiated:', paymentData);
      } else {
        throw new Error(paymentData.error || 'Payment initiation failed');
      }

    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl mb-2">Booking Confirmed!</h2>
        <p className="text-gray-600 mb-4">
          Your appointment has been successfully booked
        </p>
        {appliedCoupon && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-block">
            <p className="text-sm text-green-700">
              You saved ₹{discountAmount.toFixed(2)} with code <strong>{appliedCoupon.code}</strong>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl mb-2">Complete Your Booking</h2>
        <p className="text-gray-600">{service.name} at {vendor.name}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Service Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-1">{service.name}</h3>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                <MapPin className="h-3 w-3" />
                {vendor.location}
              </p>
              <p className="text-sm text-gray-600">Duration: {service.duration} minutes</p>
            </div>
            <div className="text-right">
              <p className="text-2xl text-orange-600">₹{service.price}</p>
            </div>
          </div>
        </div>

        {/* Date & Time Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Select Time</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Select Pet
            </label>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Choose your pet</option>
              <option value="pet_1">Max (Golden Retriever)</option>
              <option value="pet_2">Bella (Persian Cat)</option>
            </select>
          </div>
        </div>

        {/* Coupon Code Input */}
        <div className="border-t border-gray-200 pt-6">
          <CouponCodeInput
            orderAmount={originalAmount}
            customerId={customerId}
            onCouponApplied={handleCouponApplied}
            onCouponRemoved={handleCouponRemoved}
          />
        </div>

        {/* Price Summary */}
        <div className="border-t border-gray-200 pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-gray-700">
              <span>Service Price</span>
              <span>₹{originalAmount.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Discount ({appliedCoupon?.code})</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="text-lg">Total Amount</span>
              <span className="text-2xl text-orange-600">₹{finalAmount.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-sm text-green-700">
                  🎉 You're saving ₹{discountAmount.toFixed(2)}!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Book Button */}
        <button
          onClick={handleBooking}
          disabled={loading}
          className="w-full bg-orange-500 text-white py-4 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              Processing...
            </>
          ) : (
            <>
              <DollarSign className="h-5 w-5" />
              Pay ₹{finalAmount.toFixed(2)} & Book
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          By booking, you agree to our terms and conditions
        </p>
      </div>
    </div>
  );
}
