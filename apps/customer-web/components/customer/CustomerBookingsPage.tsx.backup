'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Phone, Plus } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  bookingId: string;
  vendorName: string;
  serviceName: string;
  petName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amount: number;
}

interface CustomerBookingsPageProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function CustomerBookingsPage({ phone, onBack, onNavigate }: CustomerBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    if (phone) {
      fetchBookings();
    }
  }, [phone]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<{ bookings: Booking[] }>(
        `/customer/bookings?phone=${encodeURIComponent(phone)}`
      );

      if (response.bookings) {
        setBookings(response.bookings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = activeTab === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">My Bookings</h1>
        </div>
        <button
          onClick={() => onNavigate('services')}
          className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 border-b overflow-x-auto">
        <div className="flex space-x-6">
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`py-3 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                activeTab === status
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 mb-2">{error}</p>
            <button
              onClick={fetchBookings}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">
              {activeTab === 'all' ? "You haven't made any bookings yet." : `No ${activeTab} bookings found.`}
            </h3>
            {activeTab === 'all' && (
              <button
                onClick={() => onNavigate('services')}
                className="mt-4 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
              >
                Book a Service
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                onClick={() => onNavigate('booking-details', { bookingId: booking.id })}
                className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{booking.serviceName}</h3>
                    <p className="text-sm text-gray-600">{booking.vendorName}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
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
                  <p className="text-sm text-gray-600">Pet: {booking.petName}</p>
                  <p className="text-sm font-semibold text-primary">₹{booking.amount}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

