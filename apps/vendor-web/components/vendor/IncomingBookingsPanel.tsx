'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, MapPin, Check, X, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { AcceptBookingModal } from './AcceptBookingModal';
import { DeclineBookingModal } from './DeclineBookingModal';

interface IncomingBookingsPanelProps {
  vendorId: string;
  onUpdate?: () => void;
}

export function IncomingBookingsPanel({ vendorId, onUpdate }: IncomingBookingsPanelProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'today'>('pending');

  useEffect(() => {
    loadBookings();
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [filter, vendorId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const statusFilter = filter === 'pending' ? 'pending' : filter === 'today' ? 'today' : 'all';
      const response = await apiClient.get<any>(`/vendor/bookings/${vendorId}?status=${statusFilter}`);
      setBookings(response.bookings || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowAcceptModal(true);
  };

  const handleDeclineClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowDeclineModal(true);
  };

  const handleActionSuccess = () => {
    setShowAcceptModal(false);
    setShowDeclineModal(false);
    setSelectedBooking(null);
    loadBookings();
    onUpdate?.();
  };

  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadBookings}
          className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Booking Requests</h2>
          <p className="text-sm text-gray-600">
            {pendingCount > 0 ? (
              <span className="text-orange-600 font-semibold">
                {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
              </span>
            ) : (
              'No pending requests'
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              filter === 'pending' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              filter === 'today' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="font-medium">No booking requests</p>
          <p className="text-sm">
            {filter === 'pending'
              ? "You're all caught up! New booking requests will appear here."
              : "No bookings found for this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{booking.customer?.name || booking.customer_name}</h3>
                  <p className="text-sm text-gray-600">{booking.service?.name || booking.service_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(booking.booking_date).toLocaleDateString()}</span>
                    <Clock className="w-3 h-3 ml-2" />
                    <span>{booking.booking_time}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {booking.status}
                </span>
              </div>

              {booking.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptClick(booking)}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineClick(booking)}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAcceptModal && selectedBooking && (
        <AcceptBookingModal
          booking={selectedBooking}
          vendorId={vendorId}
          onClose={() => setShowAcceptModal(false)}
          onSuccess={handleActionSuccess}
        />
      )}

      {showDeclineModal && selectedBooking && (
        <DeclineBookingModal
          booking={selectedBooking}
          vendorId={vendorId}
          onClose={() => setShowDeclineModal(false)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}

