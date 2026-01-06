'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, PlayCircle, XCircle, Key, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  otp_code?: string;
}

export function BookingLifecycleManager({ vendorId }: { vendorId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);

  useEffect(() => {
    loadVendorBookings();
  }, [vendorId]);

  async function loadVendorBookings() {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/bookings/${vendorId}`);
      setBookings(response.bookings || []);
    } catch (error: any) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptBooking(booking: Booking) {
    try {
      await apiClient.put(`/bookings/${booking.id}/status`, { 
        status: 'confirmed',
        vendorId 
      });
      loadVendorBookings();
    } catch (error: any) {
      console.error('Error accepting booking:', error);
    }
  }

  async function handleRejectBooking(booking: Booking) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await apiClient.put(`/bookings/${booking.id}/status`, { 
        status: 'cancelled',
        notes: `Rejected by vendor: ${reason}`
      });
      loadVendorBookings();
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
    }
  }

  async function handleStartService(booking: Booking) {
    try {
      await apiClient.put(`/bookings/${booking.id}/status`, { status: 'in_progress' });
      loadVendorBookings();
    } catch (error: any) {
      console.error('Error starting service:', error);
    }
  }

  async function handleCompleteService(booking: Booking) {
    setSelectedBooking(booking);
    setShowOTPModal(true);
    setOtpInput('');
  }

  async function verifyCompletionOTP() {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 4) {
      alert('Please enter a valid 4-digit OTP');
      return;
    }

    try {
      setVerifying(true);
      await apiClient.post(`/vendor/bookings/${selectedBooking.id}/complete`, {
        vendorId,
        otp: otpInput
      });
      setShowOTPModal(false);
      setOtpInput('');
      loadVendorBookings();
      alert('✅ Booking completed successfully!');
    } catch (error: any) {
      alert(error.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setVerifying(false);
    }
  }

  function copyOTPToClipboard(otp: string) {
    navigator.clipboard.writeText(otp);
    setCopiedOTP(true);
    setTimeout(() => setCopiedOTP(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Booking Lifecycle</h2>
        
        {bookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No bookings found
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{booking.customer_name}</h3>
                    <p className="text-sm text-gray-600">{booking.service_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(booking.booking_date).toLocaleDateString()} at {booking.booking_time}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                    booking.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                    booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="flex gap-2">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAcceptBooking(booking)}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectBooking(booking)}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStartService(booking)}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                    >
                      Start Service
                    </button>
                  )}
                  {booking.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteService(booking)}
                      className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                    >
                      Complete Service
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showOTPModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[380px] p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Enter Customer OTP</h3>
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FF8C42] mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowOTPModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={verifyCompletionOTP}
                disabled={verifying || otpInput.length !== 4}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

