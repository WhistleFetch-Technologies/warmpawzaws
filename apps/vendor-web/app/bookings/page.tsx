'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  service_type: string;
  total_amount: number;
  pet_name?: string;
  staff_name?: string;
}

export default function VendorBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadBookings();
  }, [router, dateFilter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        const response = await apiClient.get<{ bookings: Booking[] }>(
          `/vendor/${vendorId}/bookings?dateFilter=${dateFilter}`
        );
        setBookings(response.bookings || []);
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await apiClient.put(`/bookings/${bookingId}/status`, { status: newStatus });
      loadBookings();
    } catch (err) {
      console.error('Error updating booking:', err);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Booking Management</h1>
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            {(['today', 'week', 'month', 'all'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
                  dateFilter === d
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-orange-50'
                }`}
              >
                {d === 'all' ? 'All Time' : d}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'confirmed', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
                  filter === f
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-gray-500">No bookings found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{booking.customer_name}</p>
                        <p className="text-sm text-gray-500">{booking.customer_phone}</p>
                        {booking.pet_name && (
                          <p className="text-sm text-gray-400">Pet: {booking.pet_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{booking.service_name}</p>
                      <p className="text-sm text-gray-500 capitalize">{booking.service_type.replace('_', ' ')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">
                        {new Date(booking.booking_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">{booking.booking_time}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">₹{booking.total_amount}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {booking.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                            className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                          >
                            Start
                          </button>
                        )}
                        {booking.status === 'in_progress' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'completed')}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

