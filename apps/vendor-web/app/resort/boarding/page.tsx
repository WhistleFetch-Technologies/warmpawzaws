'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Calendar, Users, BedDouble } from 'lucide-react';

interface BoardingBooking {
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
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  created_at: string;
}

export default function BoardingPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BoardingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out'>('all');

  useEffect(() => {
    loadBookings();
  }, [filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(
        `/vendor/${vendorId}/resort/boarding-bookings?status=${filter === 'all' ? '' : filter}`
      );
      if (response.success || response.bookings) {
        setBookings(response.bookings || []);
      }
    } catch (error: any) {
      console.error('Error loading boarding bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: BoardingBooking['status']) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.put(`/vendor/${vendorId}/resort/boarding-bookings/${bookingId}/status`, {
        status: newStatus,
      });
      loadBookings();
    } catch (error: any) {
      alert(error.message || 'Failed to update booking status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    checked_in: 'bg-green-100 text-green-700',
    checked_out: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🏨 Pet Boarding</h1>
              <p className="text-sm text-gray-500">Manage boarding bookings and check-ins</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{bookings.length}</div>
            <div className="text-sm text-gray-500">Total Bookings</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">
              {bookings.filter(b => b.status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">
              {bookings.filter(b => b.status === 'checked_in').length}
            </div>
            <div className="text-sm text-green-600">Checked In</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {bookings.filter(b => b.status === 'confirmed').length}
            </div>
            <div className="text-sm text-blue-600">Confirmed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'pending', 'confirmed', 'checked_in', 'checked_out'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                filter === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No boarding bookings</h3>
            <p className="text-gray-500">Bookings will appear here when customers book boarding services</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Booking #{booking.booking_number}</h3>
                    <p className="text-sm text-gray-500">{booking.customer_name} • {booking.customer_phone}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <BedDouble className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Pet & Room</p>
                      <p className="font-medium text-gray-900">{booking.pet_name} ({booking.pet_type})</p>
                      <p className="text-sm text-gray-500">Room: {booking.room_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Check-in / Check-out</p>
                      <p className="font-medium text-gray-900">{booking.check_in_date}</p>
                      <p className="text-sm text-gray-500">to {booking.check_out_date} ({booking.total_nights} nights)</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-xl font-bold text-orange-600">₹{booking.total_amount}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {booking.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                    >
                      Confirm Booking
                    </button>
                    <button
                      onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {booking.status === 'confirmed' && (
                  <button
                    onClick={() => router.push(`/bookings/checkin?bookingId=${booking.id}`)}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                  >
                    Check In Pet
                  </button>
                )}
                {booking.status === 'checked_in' && (
                  <button
                    onClick={() => router.push(`/bookings/checkin?bookingId=${booking.id}&action=checkout`)}
                    className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
                  >
                    Check Out Pet
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

