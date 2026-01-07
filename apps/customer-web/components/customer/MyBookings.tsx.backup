'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ChevronRight, Filter } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  vendorName?: string;
  petName?: string;
  price?: number;
  address?: string | { street: string; city: string; state: string; pincode: string };
}

interface MyBookingsProps {
  phone: string;
  onBookingSelect?: (bookingId: string) => void;
}

export function MyBookings({ phone, onBookingSelect }: MyBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    loadBookings();
  }, [phone, filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ phone });
      if (filter !== 'all') {
        params.append('status', filter);
      }

      const response = await apiClient.get<{ bookings: Booking[] }>(`/bookings?${params}`);
      if (response.bookings) {
        setBookings(response.bookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === filter);

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Bookings</h1>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          {(['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 text-xs">
                  ({bookings.filter(b => b.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'You don\'t have any bookings yet' 
                : `No ${filter} bookings`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => (
              <button
                key={booking.id}
                onClick={() => onBookingSelect?.(booking.id)}
                className="w-full bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all text-left active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{booking.serviceName}</h3>
                    {booking.vendorName && (
                      <p className="text-sm text-gray-600">{booking.vendorName}</p>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(booking.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{booking.scheduledTime}</span>
                  </div>
                  {booking.petName && (
                    <p className="text-sm text-gray-600">Pet: {booking.petName}</p>
                  )}
                  {booking.price && (
                    <p className="text-sm font-semibold text-primary">₹{booking.price}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">View Details</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
