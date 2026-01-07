'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, CheckCircle, XCircle, Calendar, User } from 'lucide-react';

interface CheckInBooking {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_phone: string;
  pet_name: string;
  pet_type: string;
  room_id: string;
  room_name: string;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  total_amount: number;
  status: string;
}

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const action = searchParams.get('action') || 'checkin';

  const [booking, setBooking] = useState<CheckInBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (bookingId) {
      loadBooking();
    } else {
      router.push('/resort/boarding');
    }
  }, [bookingId, router]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(`/vendor/${vendorId}/resort/boarding-bookings/${bookingId}`);
      if (response.success || response.booking) {
        setBooking(response.booking || response);
      }
    } catch (error: any) {
      console.error('Error loading booking:', error);
      alert('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setProcessing(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId || !bookingId) return;

      await apiClient.post(`/vendor/${vendorId}/resort/boarding-bookings/${bookingId}/checkin`, {
        notes: notes,
      });
      alert('Pet checked in successfully!');
      router.push('/resort/boarding');
    } catch (error: any) {
      alert(error.message || 'Failed to check in pet');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setProcessing(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId || !bookingId) return;

      await apiClient.post(`/vendor/${vendorId}/resort/boarding-bookings/${bookingId}/checkout`, {
        notes: notes,
      });
      alert('Pet checked out successfully!');
      router.push('/resort/boarding');
    } catch (error: any) {
      alert(error.message || 'Failed to check out pet');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Booking not found</p>
          <button
            onClick={() => router.push('/resort/boarding')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            Back to Boarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {action === 'checkout' ? '✅ Check Out' : '✅ Check In'}
              </h1>
              <p className="text-sm text-gray-500">
                {action === 'checkout' ? 'Complete pet boarding stay' : 'Register pet arrival'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {/* Booking Details */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Booking Number:</span>
                <span className="font-medium text-gray-900">#{booking.booking_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium text-gray-900">{booking.customer_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium text-gray-900">{booking.customer_phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pet:</span>
                <span className="font-medium text-gray-900">{booking.pet_name} ({booking.pet_type})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Room:</span>
                <span className="font-medium text-gray-900">{booking.room_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Check-in Date:</span>
                <span className="font-medium text-gray-900">{booking.check_in_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Check-out Date:</span>
                <span className="font-medium text-gray-900">{booking.check_out_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">{booking.total_nights} nights</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-gray-600 font-semibold">Total Amount:</span>
                <span className="text-xl font-bold text-orange-600">₹{booking.total_amount}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {action === 'checkout' ? 'Check-out Notes' : 'Check-in Notes'} (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={4}
              placeholder={`Add any notes about the ${action === 'checkout' ? 'check-out' : 'check-in'}...`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={action === 'checkout' ? handleCheckOut : handleCheckIn}
              disabled={processing}
              className={`flex-1 px-4 py-2 rounded-lg transition font-medium flex items-center justify-center gap-2 ${
                action === 'checkout'
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50`}
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  {action === 'checkout' ? (
                    <>
                      <XCircle className="w-5 h-5" />
                      Check Out
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Check In
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

