'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  service_type: string;
  notes?: string;
  otp_code?: string;
  otp_verified?: boolean;
}

interface VendorBookingsPageProps {
  vendorId: string;
}

export function VendorBookingsPage({ vendorId }: VendorBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('upcoming'); // ✅ Default to upcoming to show scheduled bookings
  
  // ✅ OTP Completion Modal State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [otpInput, setOTPInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadBookings();
  }, [vendorId, filter, dateFilter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      let url = `/vendor/${vendorId}/bookings`;
      const params = new URLSearchParams();
      
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      if (dateFilter === 'today') {
        params.append('date', new Date().toISOString().split('T')[0]);
      } else if (dateFilter === 'upcoming') {
        params.append('startDate', new Date().toISOString().split('T')[0]);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await apiClient.get<any>(url);
      if (response.success) {
        setBookings(response.bookings || []);
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    try {
      // ✅ For completing bookings, show OTP modal
      if (newStatus === 'completed') {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
          setSelectedBooking(booking);
          setShowOTPModal(true);
          return;
        }
      }
      
      await apiClient.put(`/bookings/${bookingId}/status`, { status: newStatus });
      toast.success('Booking status updated');
      loadBookings();
    } catch (err) {
      console.error('Error updating booking:', err);
      toast.error('Failed to update booking status');
    }
  };

  // ✅ Handle OTP verification and complete booking
  const handleCompleteWithOTP = async () => {
    if (!selectedBooking || !otpInput.trim()) {
      toast.error('Please enter the OTP');
      return;
    }

    setVerifying(true);
    try {
      const result = await apiClient.post(`/vendor/bookings/${selectedBooking.id}/complete`, {
        otp: otpInput.trim(),
        vendorId: vendorId,
      }) as any;

      if (result.success) {
        toast.success('✅ Appointment completed successfully!');
        if (selectedBooking.payment_status === 'paid') {
          toast.success(`💰 ₹${selectedBooking.total_amount} added to your earnings`);
        }
        setShowOTPModal(false);
        setSelectedBooking(null);
        setOTPInput('');
        loadBookings();
      } else {
        toast.error(result.error || 'Failed to complete booking');
      }
    } catch (err: any) {
      console.error('Error completing booking:', err);
      toast.error(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ✅ Handle check-in (start session)
  const handleCheckIn = async (booking: Booking) => {
    setSelectedBooking(booking);
    setShowOTPModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'at_vendor': return '🏥';
      case 'at_home': return '🏠';
      case 'online': return '💻';
      default: return '📍';
    }
  };

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-0">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <button
          onClick={loadBookings}
          className="p-0 hover:bg-gray-100 rounded-lg"
        >
          🔄
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-0">
        <div className="flex bg-white rounded-lg p-0 shadow-sm">
          {['today', 'upcoming', 'all'].map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-4 py-0 rounded-lg text-sm font-medium transition ${
                dateFilter === d
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {d === 'today' ? "Today's" : d === 'upcoming' ? 'Upcoming' : 'All Time'}
            </button>
          ))}
        </div>
        <select
          value={filter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
          className="px-4 py-0 bg-white border rounded-lg text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-0 bg-white rounded-2xl">
          <span className="text-6xl">📅</span>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No bookings found</h2>
          <p className="text-gray-500 mt-0">
            {dateFilter === 'today' ? 'No bookings scheduled for today' : 'No bookings match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-2xl">
                    {getServiceTypeIcon(booking.service_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{booking.customer_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                      {booking.payment_status === 'paid' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          💳 Paid
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{booking.service_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>📅 {new Date(booking.booking_date).toLocaleDateString()}</span>
                      <span>⏰ {booking.booking_time}</span>
                      <span className="font-semibold text-orange-500">₹{booking.total_amount}</span>
                    </div>
                    {booking.notes && (
                      <p className="text-sm text-gray-400 mt-1 italic">"{booking.notes}"</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                        className="px-0 py-0 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        ✓ Confirm
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                        className="px-0 py-0 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200"
                      >
                        ✗ Cancel
                      </button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'in_progress')}
                      className="px-0 py-0 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      ▶ Start
                    </button>
                  )}
                  {booking.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'completed')}
                      className="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                    >
                      ✓ Complete
                    </button>
                  )}
                  {booking.status === 'confirmed' && booking.payment_status === 'paid' && (
                    <button
                      onClick={() => handleCheckIn(booking)}
                      className="px-3 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
                    >
                      🔑 Check-in
                    </button>
                  )}
                  <a
                    href={`tel:${booking.customer_phone}`}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg text-center hover:bg-gray-200"
                  >
                    📞 Call
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ OTP Verification Modal */}
      {showOTPModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Enter Customer OTP</h3>
              <p className="text-gray-500 mt-1">
                Ask the customer for their check-in OTP to complete the appointment
              </p>
            </div>

            {/* Booking Details */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{selectedBooking.customer_name}</p>
                  <p className="text-sm text-gray-500">{selectedBooking.service_name}</p>
                </div>
                <p className="font-bold text-orange-500">₹{selectedBooking.total_amount}</p>
              </div>
            </div>

            {/* OTP Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 4-digit OTP
              </label>
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOTPInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter OTP"
                maxLength={4}
                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOTPModal(false);
                  setSelectedBooking(null);
                  setOTPInput('');
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 font-medium hover:bg-gray-50"
                disabled={verifying}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteWithOTP}
                disabled={verifying || otpInput.length !== 4}
                className="flex-1 py-3 px-4 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : (
                  <>✓ Complete Appointment</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

