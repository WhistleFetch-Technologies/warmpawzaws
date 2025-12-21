import { useState, useEffect } from 'react';
import { RefreshCw, Clock, Phone, MapPin, CheckCircle, Play, Square, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface TodayBookingsOTPProps {
  vendorId: string;
  vendorName: string;
}

export function TodayBookingsOTP({ vendorId, vendorName }: TodayBookingsOTPProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpAction, setOTPAction] = useState<'start' | 'end'>('start');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [otpInput, setOtpInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTodayBookings();
    // Refresh every 30 seconds
    const interval = setInterval(loadTodayBookings, 30000);
    return () => clearInterval(interval);
  }, [vendorId]);

  const loadTodayBookings = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/today-bookings`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      } else {
        toast.error('Failed to load bookings');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartService = (booking: any) => {
    setSelectedBooking(booking);
    setOTPAction('start');
    setOtpInput('');
    setNotes('');
    setShowOTPModal(true);
  };

  const handleEndService = (booking: any) => {
    setSelectedBooking(booking);
    setOTPAction('end');
    setOtpInput('');
    setNotes('');
    setShowOTPModal(true);
  };

  // ✅ MIGRATION: Use new lifecycle endpoint for end OTP (start OTP uses existing endpoint)
  const handleVerifyOTP = async () => {
    if (!otpInput || (otpInput.length !== 4 && otpInput.length !== 6)) {
      toast.error('Please enter 4 or 6-digit OTP');
      return;
    }

    try {
      setSubmitting(true);

      let endpoint: string;
      let body: any;

      if (otpAction === 'start') {
        // Start OTP - use existing endpoint
        endpoint = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${selectedBooking.id}/verify-start`;
        body = {
          otp: otpInput,
          vendorId,
          location: null // Could get from browser geolocation
        };
      } else {
        // ✅ MIGRATION: End OTP - use new complete lifecycle endpoint
        endpoint = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${selectedBooking.id}/verify-otp-complete`;
        body = {
          otp: otpInput,
          action: 'end', // 'end' or 'complete'
          vendorId,
          completionNotes: notes
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show enhanced success message for end OTP with lifecycle info
        if (otpAction === 'end' && data.success && data.earnings) {
          const earningsInfo = ` Earnings: ₹${data.earnings.vendorEarnings}`;
          const settlementInfo = data.settlement ? ` Settlement: ${data.settlement.status}` : '';
          toast.success(`✅ Service completed!${earningsInfo}${settlementInfo}`);
        } else {
          toast.success(data.message || 'OTP verified successfully');
        }
        
        setShowOTPModal(false);
        setSelectedBooking(null);
        setOtpInput('');
        setNotes('');
        loadTodayBookings();
      } else {
        const error = await response.json();
        toast.error(error.error || error.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getServiceTypeLabel = (type: string) => {
    const labels: any = {
      'vet': 'Veterinary',
      'grooming': 'Grooming',
      'training': 'Training',
      'walker': 'Walking',
      'boarding': 'Boarding',
      'meal': 'Meal Delivery',
      'home_visit': 'Home Visit'
    };
    return labels[type] || type;
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-gray-900">Today's Bookings</h1>
              <p className="text-sm text-gray-600">{vendorName}</p>
            </div>
            <Button
              onClick={loadTodayBookings}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-blue-900">
                {bookings.filter(b => b.status === 'confirmed').length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600 font-medium">In Progress</p>
              <p className="text-2xl font-bold text-green-900">
                {bookings.filter(b => b.status === 'in_progress').length}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 font-medium">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {bookings.filter(b => b.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No Bookings Today</h3>
            <p className="text-gray-600">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl border hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900">
                        {booking.customerName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(booking.status)}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {getServiceTypeLabel(booking.serviceType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{booking.scheduledTime}</span>
                      </div>
                      {booking.customerPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span>{booking.customerPhone}</span>
                        </div>
                      )}
                      {booking.petName && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{booking.petName}</span>
                          {booking.petBreed && (
                            <span className="text-gray-400">({booking.petBreed})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-green-600">₹{booking.price}</p>
                    <p className="text-xs text-gray-500">
                      {booking.paymentStatus === 'completed' ? '✓ Paid' : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Customer Notes */}
                {booking.customerNotes && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium mb-1">
                      Customer Notes:
                    </p>
                    <p className="text-sm text-yellow-900">{booking.customerNotes}</p>
                  </div>
                )}

                {/* In Progress Info */}
                {booking.status === 'in_progress' && booking.startedAt && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-800 font-medium mb-1">
                      Service Started:
                    </p>
                    <p className="text-sm text-green-900">
                      {new Date(booking.startedAt).toLocaleTimeString()} • 
                      {' '}{Math.floor((Date.now() - new Date(booking.startedAt).getTime()) / 60000)} min ago
                    </p>
                  </div>
                )}

                {/* Completed Info */}
                {booking.status === 'completed' && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="font-medium">{booking.duration} minutes</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Completed At</p>
                        <p className="font-medium">
                          {new Date(booking.completedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {booking.completionNotes && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-sm">{booking.completionNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  {booking.status === 'confirmed' && (
                    <Button
                      onClick={() => handleStartService(booking)}
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Service (OTP Required)
                    </Button>
                  )}

                  {booking.status === 'in_progress' && (
                    <Button
                      onClick={() => handleEndService(booking)}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      End Service (OTP Required)
                    </Button>
                  )}

                  {booking.status === 'completed' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Service Completed</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OTP Modal */}
      <Dialog open={showOTPModal} onOpenChange={() => { setShowOTPModal(false); setSelectedBooking(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {otpAction === 'start' ? 'Start Service' : 'End Service'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Booking Info */}
            {selectedBooking && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{selectedBooking.customerName}</p>
                <p className="text-sm text-gray-600">{selectedBooking.scheduledTime}</p>
              </div>
            )}

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Enter Customer's {otpAction === 'start' ? 'Start' : 'End'} OTP *
              </label>
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 border rounded-lg text-center text-2xl font-bold tracking-widest"
                placeholder="••••"
                maxLength={4}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Ask customer to share their {otpAction === 'start' ? 'start' : 'end'} OTP
              </p>
            </div>

            {/* Completion Notes (End only) */}
            {otpAction === 'end' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Service Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg resize-none"
                  rows={3}
                  placeholder="E.g., Service completed successfully. Pet was cooperative."
                />
              </div>
            )}

            {/* Warning */}
            <div className="p-3 bg-yellow-50 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-900">
                Only the correct OTP from the customer will allow you to {otpAction === 'start' ? 'start' : 'complete'} this service.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => { setShowOTPModal(false); setSelectedBooking(null); }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyOTP}
                className={`flex-1 ${
                  otpAction === 'start'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
                disabled={submitting || otpInput.length !== 4}
              >
                {submitting ? 'Verifying...' : 'Verify & Continue'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
