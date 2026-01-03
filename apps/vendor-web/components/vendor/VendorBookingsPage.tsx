'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  service_type: string;
  notes?: string;
}

interface VendorBookingsPageProps {
  vendorId: string;
}

export function VendorBookingsPage({ vendorId }: VendorBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');

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
      await apiClient.put(`/bookings/${bookingId}/status`, { status: newStatus });
      loadBookings();
    } catch (err) {
      console.error('Error updating booking:', err);
      alert('Failed to update booking status');
    }
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <button
          onClick={loadBookings}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          🔄
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex bg-white rounded-lg p-1 shadow-sm">
          {['today', 'upcoming', 'all'].map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
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
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-white border rounded-lg text-sm"
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
        <div className="text-center py-12 bg-white rounded-2xl">
          <span className="text-6xl">📅</span>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No bookings found</h2>
          <p className="text-gray-500 mt-2">
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{booking.customer_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{booking.service_name}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>📅 {new Date(booking.booking_date).toLocaleDateString()}</span>
                      <span>⏰ {booking.booking_time}</span>
                      <span className="font-semibold text-orange-500">₹{booking.total_amount}</span>
                    </div>
                    {booking.notes && (
                      <p className="text-sm text-gray-400 mt-1 italic">"{booking.notes}"</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        ✓ Confirm
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                        className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200"
                      >
                        ✗ Cancel
                      </button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'in_progress')}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      ▶ Start
                    </button>
                  )}
                  {booking.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'completed')}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                    >
                      ✓ Complete
                    </button>
                  )}
                  <a
                    href={`tel:${booking.customer_phone}`}
                    className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-lg text-center hover:bg-gray-200"
                  >
                    📞 Call
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

