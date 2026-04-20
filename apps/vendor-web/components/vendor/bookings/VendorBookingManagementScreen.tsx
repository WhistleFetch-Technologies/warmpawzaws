'use client';

/**
 * Vendor Booking Management Screen
 * Adapted for AWS Lambda, RDS, Cognito architecture
 * Manages vendor bookings with real-time updates
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { DeclineBookingModal } from '@/components/vendor/DeclineBookingModal';

interface VendorBookingManagementScreenProps {
  vendorId?: string;
  staffId?: string;
  onBack?: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

interface Booking {
  id: string;
  booking_id: string;
  customer_name: string;
  service_name: string;
  status: string;
  booking_date: string;
  booking_time: string;
  total_amount: number;
  customer_phone?: string;
  isRescheduled?: boolean; // Indicates if booking was rescheduled from original time/date
  rescheduledAt?: string | null; // Timestamp when booking was rescheduled
}

export function VendorBookingManagementScreen({
  vendorId,
  staffId,
  onBack,
  onSelectBooking,
}: VendorBookingManagementScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [declineBooking, setDeclineBooking] = useState<Booking | null>(null);
  const isStaff = !!staffId;

  useEffect(() => {
    loadBookings();
  }, [vendorId, staffId, filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      // Get vendorId from props or localStorage
      const effectiveVendorId = vendorId || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') : '');
      
      if (!effectiveVendorId) {
        console.warn('[VendorBookingManagementScreen] No vendorId available');
        setBookings([]);
        return;
      }

      console.log(`[VendorBookingManagementScreen] Loading bookings for vendor: ${effectiveVendorId}`);

      // ✅ AWS Lambda: Using vendor bookings endpoint with vendorId
      const response = await apiClient.get<{
        success?: boolean;
        bookings?: Booking[];
        error?: string;
      }>(`/vendor/bookings/${effectiveVendorId}?filter=${filter}`);

      if (response.success && response.bookings) {
        setBookings(response.bookings);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      console.error(`[VendorBookingManagementScreen] Error loading bookings:`, error);
      toast.error('Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'in_progress':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'cancelled':
      case 'cancelled_by_vendor':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Booking Management</h1>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        <div className="flex-1 px-4 py-4">
          {bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {booking.customer_name || 'Customer'}
                        </h3>
                        {booking.isRescheduled && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            📅 Rescheduled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{booking.service_name || 'Service'}</p>
                      {booking.customer_phone && (
                        <p className="text-xs text-gray-500 mt-1">{booking.customer_phone}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {booking.booking_date && (
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <span>📅 {formatDate(booking.booking_date)}</span>
                      {booking.booking_time && <span>⏰ {booking.booking_time}</span>}
                    </div>
                  )}

                  {booking.total_amount && (
                    <p className="text-lg font-bold text-gray-900 mb-3">
                      ₹{booking.total_amount}
                    </p>
                  )}

                  {!isStaff &&
                    vendorId &&
                    (booking.status === 'pending' || booking.status === 'confirmed') && (
                    <div className="flex space-x-2 mb-3">
                      <button
                        className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                        onClick={() =>
                          setDeclineBooking({
                            ...booking,
                            id: booking.id,
                            customerName: booking.customer_name,
                            scheduledDate: booking.booking_date,
                            scheduledTime: booking.booking_time,
                          } as any)
                        }
                      >
                        Decline / refund
                      </button>
                    </div>
                  )}

                  <button
                    className="w-full text-orange-500 text-sm font-medium py-2 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                    onClick={() => onSelectBooking?.(booking.id)}
                  >
                    View Details →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-gray-500">No bookings found</p>
            </div>
          )}
        </div>
      </div>

      {declineBooking && vendorId && (
        <DeclineBookingModal
          booking={declineBooking as any}
          vendorId={vendorId}
          onClose={() => setDeclineBooking(null)}
          onSuccess={() => {
            setDeclineBooking(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
