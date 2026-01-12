'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Clock, User, Phone, MapPin, DollarSign,
  Check, X, AlertCircle, ChevronRight, PawPrint
} from 'lucide-react';
import { toast } from 'sonner';
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
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<any>(`/vendor/bookings/${vendorId}?status=${filter}`);
      setBookings(data.bookings || data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load bookings');
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
    return <LoadingState message="Loading booking requests..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadBookings} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
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
          <Button
            size="sm"
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </Button>
          <Button
            size="sm"
            variant={filter === 'today' ? 'default' : 'outline'}
            onClick={() => setFilter('today')}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="No booking requests"
          description={
            filter === 'pending'
              ? "You're all caught up! New booking requests will appear here."
              : "No bookings found for this filter."
          }
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingRequestCard
              key={booking.id}
              booking={booking}
              onAccept={() => handleAcceptClick(booking)}
              onDecline={() => handleDeclineClick(booking)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
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

interface BookingRequestCardProps {
  booking: any;
  onAccept: () => void;
  onDecline: () => void;
}

function BookingRequestCard({ booking, onAccept, onDecline }: BookingRequestCardProps) {
  const isPending = booking.status === 'pending';
  const isUrgent = () => {
    if (!booking.scheduledDate) return false;
    const bookingDate = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '00:00'}`);
    const hoursUntil = (bookingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursUntil <= 24;
  };

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">⏳ Pending</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-700">✓ Confirmed</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-700">✗ Declined</Badge>;
      default:
        return <Badge variant="outline">{booking.status}</Badge>;
    }
  };

  return (
    <Card className={`p-4 ${isPending ? 'border-l-4 border-l-orange-500' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-blue-50 rounded-lg">
            <PawPrint className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {booking.customerName || 'Customer'}
              </h3>
              {isUrgent() && (
                <Badge variant="destructive" className="text-xs">
                  🔥 Urgent
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {booking.serviceName || booking.serviceType}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Booking Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailItem
          icon={<Calendar className="w-4 h-4 text-gray-400" />}
          label="Date"
          value={new Date(booking.scheduledDate).toLocaleDateString()}
        />
        <DetailItem
          icon={<Clock className="w-4 h-4 text-gray-400" />}
          label="Time"
          value={booking.scheduledTime || 'Flexible'}
        />
        
        {booking.petName && (
          <DetailItem
            icon={<PawPrint className="w-4 h-4 text-gray-400" />}
            label="Pet"
            value={booking.petName}
          />
        )}
        
        <DetailItem
          icon={<DollarSign className="w-4 h-4 text-gray-400" />}
          label="Amount"
          value={`₹${booking.totalAmount || booking.price}`}
        />
      </div>

      {booking.isHomeService && booking.customerAddress && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600">Service Location</p>
              <p className="text-sm text-gray-900">{booking.customerAddress}</p>
              {booking.distance && (
                <p className="text-xs text-gray-500 mt-1">
                  {booking.distance} km away
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {booking.customerNotes && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 mb-1">Customer Notes</p>
          <p className="text-sm text-gray-800">{booking.customerNotes}</p>
        </div>
      )}

      {booking.customerPhone && (
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.open(`tel:${booking.customerPhone}`)}
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Customer
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      {isPending && (
        <div className="grid grid-cols-2 gap-2 pt-3 border-t">
          <Button
            onClick={onDecline}
            variant="outline"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <X className="w-4 h-4 mr-2" />
            Decline
          </Button>
          <Button
            onClick={onAccept}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept
          </Button>
        </div>
      )}

      {booking.status === 'confirmed' && (
        <div className="pt-3 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {/* Navigate to booking details */}}
          >
            View Details
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </Card>
  );
}

function DetailItem({ icon, label, value }: any) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <p className="text-xs text-gray-600">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
