import { useState, useEffect } from 'react';
import { LoadingState, ErrorState } from '../ui/states';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { 
  ArrowLeft, Calendar, Clock, MapPin, User, Phone, 
  DollarSign, CheckCircle, XCircle, AlertCircle, 
  Edit, Trash2, FileText, Navigation
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { RescheduleBookingModal } from './RescheduleBookingModal';
import { CancelBookingModal } from './CancelBookingModal';

interface BookingDetailsCompleteProps {
  bookingId: string;
  customerId: string;
  onBack: () => void;
  onBookingUpdated?: () => void;
}

export function BookingDetailsComplete({ 
  bookingId, 
  customerId, 
  onBack,
  onBookingUpdated 
}: BookingDetailsCompleteProps) {
  const [booking, setBooking] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ FIX: Use SQL-migrated appointment endpoint
      const response = await fetch(
        `${API_BASE}/appointment/${bookingId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (!response.ok) throw new Error('Failed to load booking');

      const data = await response.json();
      // Map appointment data to booking format for component compatibility
      const appointment = data.appointment || data;
      setBooking({
        ...appointment,
        id: appointment.id || appointment.appointmentId || bookingId,
        bookingId: appointment.id || appointment.appointmentId || bookingId,
        vendor: data.vendor || appointment.vendor,
        staff: data.staff || appointment.staff,
        customer: data.customer || appointment.customer,
      });
      setVendor(data.vendor || appointment.vendor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'rescheduled': return 'bg-purple-100 text-purple-700';
      case 'vendor_en_route': return 'bg-indigo-100 text-indigo-700';
      case 'vendor_arrived': return 'bg-teal-100 text-teal-700';
      case 'in_progress': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'declined': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
      case 'declined': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in_progress': return <AlertCircle className="w-5 h-5 text-green-600" />;
      default: return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const canReschedule = () => {
    return booking?.status === 'confirmed' || booking?.status === 'pending';
  };

  const canCancel = () => {
    return booking?.status !== 'completed' && booking?.status !== 'cancelled';
  };

  const handleRescheduleSuccess = () => {
    setShowReschedule(false);
    loadBookingDetails();
    onBookingUpdated?.();
    toast.success('Booking rescheduled successfully');
  };

  const handleCancelSuccess = () => {
    setShowCancel(false);
    loadBookingDetails();
    onBookingUpdated?.();
    toast.success('Booking cancelled');
  };

  if (loading) return <LoadingState message="Loading booking details..." />;
  if (error) return <ErrorState message={error} onRetry={loadBookingDetails} />;
  if (!booking) return <ErrorState message="Booking not found" onRetry={loadBookingDetails} />;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">Booking Details</h1>
            <p className="text-sm text-gray-600">#{booking.id.slice(-8)}</p>
          </div>
          {getStatusIcon(booking.status)}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Status Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Badge className={getStatusColor(booking.status)}>
                {booking.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {booking.status === 'cancelled' && booking.refund && (
                <div className="mt-2 text-sm">
                  <p className="text-gray-600">
                    Refund: <span className="font-semibold text-green-600">
                      ₹{booking.refund.amount} ({booking.refund.percentage}%)
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {booking.refund.status}
                  </p>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                ₹{booking.totalAmount || booking.price}
              </p>
              <p className="text-xs text-gray-500">
                {booking.paymentStatus === 'completed' ? '✓ Paid' : 'Payment Pending'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold text-gray-900 text-sm">Booking Timeline</h3>
            {booking.createdAt && (
              <TimelineItem 
                icon={<Calendar className="w-4 h-4" />}
                label="Booked"
                value={new Date(booking.createdAt).toLocaleString()}
              />
            )}
            {booking.acceptedAt && (
              <TimelineItem 
                icon={<CheckCircle className="w-4 h-4" />}
                label="Confirmed"
                value={new Date(booking.acceptedAt).toLocaleString()}
              />
            )}
            {booking.vendorDepartedAt && (
              <TimelineItem 
                icon={<Navigation className="w-4 h-4" />}
                label="Vendor En Route"
                value={new Date(booking.vendorDepartedAt).toLocaleString()}
              />
            )}
            {booking.startedAt && (
              <TimelineItem 
                icon={<CheckCircle className="w-4 h-4" />}
                label="Service Started"
                value={new Date(booking.startedAt).toLocaleString()}
              />
            )}
            {booking.completedAt && (
              <TimelineItem 
                icon={<CheckCircle className="w-4 h-4" />}
                label="Completed"
                value={new Date(booking.completedAt).toLocaleString()}
                extra={booking.duration && `Duration: ${booking.duration} min`}
              />
            )}
            {booking.cancelledAt && (
              <TimelineItem 
                icon={<XCircle className="w-4 h-4" />}
                label="Cancelled"
                value={new Date(booking.cancelledAt).toLocaleString()}
                extra={booking.cancellationReason}
              />
            )}
          </div>
        </Card>

        {/* OTP Card (for upcoming bookings) */}
        {booking.showOTPs && booking.otps && !booking.otp.startUsed && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Your Service OTPs
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                <p className="text-xs text-gray-600 mb-1">Start OTP</p>
                <p className="text-3xl font-bold text-gray-900 tracking-wider">
                  {booking.otps.start}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {booking.otps.startUsed ? '✓ Used' : 'Share when service starts'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                <p className="text-xs text-gray-600 mb-1">End OTP</p>
                <p className="text-3xl font-bold text-gray-900 tracking-wider">
                  {booking.otps.end}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {booking.otps.endUsed ? '✓ Used' : 'Share when service ends'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Service Details */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Service Details</h3>
          <div className="space-y-3">
            <DetailRow 
              icon={<Calendar className="w-5 h-5 text-gray-400" />}
              label="Date"
              value={new Date(booking.scheduledDate).toLocaleDateString()}
            />
            <DetailRow 
              icon={<Clock className="w-5 h-5 text-gray-400" />}
              label="Time"
              value={booking.scheduledTime || 'Not specified'}
            />
            {booking.customerAddress && (
              <DetailRow 
                icon={<MapPin className="w-5 h-5 text-gray-400" />}
                label="Location"
                value={booking.customerAddress}
              />
            )}
          </div>
        </Card>

        {/* Vendor Details */}
        {vendor && (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Provider Details</h3>
            <div className="space-y-3">
              <DetailRow 
                icon={<User className="w-5 h-5 text-gray-400" />}
                label="Business Name"
                value={vendor.businessName}
              />
              {vendor.phone && (
                <DetailRow 
                  icon={<Phone className="w-5 h-5 text-gray-400" />}
                  label="Contact"
                  value={vendor.phone}
                />
              )}
              {vendor.address && (
                <DetailRow 
                  icon={<MapPin className="w-5 h-5 text-gray-400" />}
                  label="Address"
                  value={vendor.address}
                />
              )}
            </div>
          </Card>
        )}

        {/* Notes */}
        {booking.customerNotes && (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Your Notes</h3>
            <p className="text-gray-600">{booking.customerNotes}</p>
          </Card>
        )}

        {booking.completionNotes && (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Service Notes</h3>
            <p className="text-gray-600">{booking.completionNotes}</p>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          {canReschedule() && (
            <Button
              onClick={() => setShowReschedule(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Reschedule
            </Button>
          )}
          {canCancel() && (
            <Button
              onClick={() => setShowCancel(true)}
              variant="outline"
              className="flex items-center gap-2 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showReschedule && (
        <RescheduleBookingModal
          bookingId={bookingId}
          currentDate={booking.scheduledDate}
          currentTime={booking.scheduledTime}
          onClose={() => setShowReschedule(false)}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {showCancel && (
        <CancelBookingModal
          bookingId={bookingId}
          customerId={customerId}
          onClose={() => setShowCancel(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}

function TimelineItem({ icon, label, value, extra }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-1.5 bg-gray-100 rounded-full">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">{value}</p>
        {extra && <p className="text-xs text-gray-500">{extra}</p>}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex-1">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
