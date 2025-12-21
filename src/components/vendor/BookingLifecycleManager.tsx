import { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { CheckCircle2, Clock, PlayCircle, XCircle, Key, Copy, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { copyTextToClipboard } from '../../utils/shareUtils';
import { projectId, publicAnonKey } from '../../utils/supabase/info'; // ✅ FIX: Add missing imports

interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vendorId: string;
  petId: string;
  petName: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  bookingDate: string;
  bookingTime: string;
  price: number;
  duration: number;
  completionOTP?: string; // Software-generated OTP for booking completion
  otpGeneratedAt?: string;
  otpExpiresAt?: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    updatedBy: string;
    note?: string;
  }>;
  notes?: string;
  vendorEarnings?: number; // Revenue realized upon OTP verification
  platformCommission?: number;
  createdAt: string;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    description: 'Awaiting vendor confirmation'
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle2,
    description: 'Vendor confirmed - OTP generated'
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-purple-100 text-purple-800',
    icon: PlayCircle,
    description: 'Service is being delivered'
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
    description: 'Service completed - Revenue realized'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    description: 'Booking cancelled'
  }
};

export function BookingLifecycleManager() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [vendorId, setVendorId] = useState<string>(''); // Get from auth context

  useEffect(() => {
    // Get vendor ID from auth and load bookings
    loadVendorBookings();
  }, []);

  async function loadVendorBookings() {
    try {
      setLoading(true);
      // Replace with actual vendor ID from auth context
      const testVendorId = 'vendor_12345';
      setVendorId(testVendorId);
      
      const data = await bookingApi.getVendorBookings(testVendorId);
      setBookings(data.bookings || []);
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      toast.error(error.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptBooking(booking: Booking) {
    try {
      // Accept booking and generate completion OTP
      await bookingApi.updateStatus(booking.id, 'confirmed', 'Booking accepted by vendor');
      
      // OTP is auto-generated on backend when status changes to confirmed
      toast.success('Booking accepted! Completion OTP generated.');
      loadVendorBookings();
      
      // Show OTP to vendor
      const updatedBooking = await bookingApi.getById(booking.id);
      setSelectedBooking(updatedBooking.booking);
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      toast.error(error.message || 'Failed to accept booking');
    }
  }

  async function handleRejectBooking(booking: Booking) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await bookingApi.updateStatus(booking.id, 'cancelled', `Rejected by vendor: ${reason}`);
      toast.success('Booking rejected');
      loadVendorBookings();
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      toast.error(error.message || 'Failed to reject booking');
    }
  }

  async function handleStartService(booking: Booking) {
    try {
      await bookingApi.updateStatus(booking.id, 'in_progress', 'Service started');
      toast.success('Service marked as in progress');
      loadVendorBookings();
    } catch (error: any) {
      console.error('Error starting service:', error);
      toast.error(error.message || 'Failed to start service');
    }
  }

  async function handleCompleteService(booking: Booking) {
    setSelectedBooking(booking);
    setShowOTPModal(true);
    setOtpInput('');
  }

  // ✅ MIGRATION: Use new complete lifecycle endpoint (OTP → Earnings → Settlement → Payout)
  async function verifyCompletionOTP() {
    if (!selectedBooking) return;
    
    // Support both 4-digit and 6-digit OTPs
    if (otpInput.length !== 4 && otpInput.length !== 6) {
      toast.error('Please enter a valid 4 or 6-digit OTP');
      return;
    }

    try {
      setVerifying(true);
      
      const bookingId = selectedBooking.id;
      const vendorId = selectedBooking.vendorId;
      
      // ✅ NEW: Use complete lifecycle endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/verify-otp-complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            otp: otpInput,
            action: 'end', // 'end' or 'complete' for completion OTP
            vendorId
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success && data.verified) {
        // Show success message with earnings and settlement info
        const earningsInfo = data.earnings ? ` Earnings: ₹${data.earnings.vendorEarnings}` : '';
        const settlementInfo = data.settlement ? ` Settlement: ${data.settlement.status}` : '';
        const payoutInfo = data.payout?.scheduled ? ` Payout scheduled: ${new Date(data.payout.scheduledAt).toLocaleDateString()}` : '';
        
        toast.success(`✅ Booking completed!${earningsInfo}${settlementInfo}${payoutInfo}`);
        setShowOTPModal(false);
        setOtpInput('');
        loadVendorBookings();
      } else {
        const errorMessage = data.error || data.message || 'Invalid OTP. Please check and try again.';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  }

  function copyOTPToClipboard(otp: string) {
    copyTextToClipboard(otp);
    setCopiedOTP(true);
    setTimeout(() => setCopiedOTP(false), 2000);
  }

  function getStatusTimeline(booking: Booking) {
    const timeline = [];
    
    if (booking.statusHistory && booking.statusHistory.length > 0) {
      return booking.statusHistory.map(item => ({
        status: item.status,
        timestamp: item.timestamp,
        note: item.note
      }));
    }

    // Fallback timeline
    timeline.push({
      status: 'pending',
      timestamp: booking.createdAt,
      note: 'Booking created'
    });

    if (booking.status !== 'pending') {
      timeline.push({
        status: booking.status,
        timestamp: new Date().toISOString(),
        note: ''
      });
    }

    return timeline;
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const inProgressBookings = bookings.filter(b => b.status === 'in_progress');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.vendorEarnings || b.price * 0.9), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl">Booking Lifecycle Management</h1>
        <p className="text-sm text-gray-500">
          Manage bookings with software OTP verification for revenue realization
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{pendingBookings.length}</p>
            <p className="text-xs text-gray-500">Needs action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{confirmedBookings.length}</p>
            <p className="text-xs text-gray-500">OTP generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{inProgressBookings.length}</p>
            <p className="text-xs text-gray-500">Active services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{completedBookings.length}</p>
            <p className="text-xs text-gray-500">Revenue realized</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">₹{totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-gray-500">From completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">Loading bookings...</div>
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">No bookings found</div>
            </CardContent>
          </Card>
        ) : (
          bookings.map((booking) => {
            const StatusIcon = STATUS_CONFIG[booking.status].icon;
            const isOTPExpired = booking.otpExpiresAt && new Date(booking.otpExpiresAt) < new Date();
            
            return (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {booking.serviceName} - {booking.petName}
                      </CardTitle>
                      <CardDescription>
                        Customer: {booking.customerName} • {booking.customerPhone}
                      </CardDescription>
                    </div>
                    <Badge className={STATUS_CONFIG[booking.status].color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {STATUS_CONFIG[booking.status].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Booking Details */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Date & Time:</span>
                      <p className="font-medium">{booking.bookingDate} {booking.bookingTime}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Service Price:</span>
                      <p className="font-medium">₹{booking.price}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <p className="font-medium">{booking.duration} minutes</p>
                    </div>
                  </div>

                  {/* Completion OTP Display (for confirmed bookings) */}
                  {booking.status === 'confirmed' && booking.completionOTP && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Key className="w-5 h-5 text-orange-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-orange-900">Completion OTP Generated</p>
                            <p className="text-xs text-orange-700 mt-1">
                              Share this 6-digit OTP with the customer. They will provide it to you upon service completion for revenue realization.
                            </p>
                            <div className="flex items-center gap-3 mt-3">
                              <div className="bg-white border-2 border-orange-300 rounded-lg px-4 py-2">
                                <p className="text-2xl font-mono tracking-widest text-orange-600">
                                  {booking.completionOTP}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyOTPToClipboard(booking.completionOTP!)}
                              >
                                {copiedOTP ? (
                                  <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy OTP
                                  </>
                                )}
                              </Button>
                            </div>
                            {isOTPExpired && (
                              <p className="text-xs text-red-600 mt-2">
                                ⚠️ OTP expired. Please contact support.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Revenue Info (for completed bookings) */}
                  {booking.status === 'completed' && booking.vendorEarnings && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-900">Revenue Realized ✅</p>
                          <p className="text-xs text-green-700 mt-1">Payment processed after OTP verification</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-700">₹{booking.vendorEarnings}</p>
                          <p className="text-xs text-green-600">
                            (Commission: ₹{booking.platformCommission || (booking.price * 0.1).toFixed(0)})
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Timeline */}
                  <div>
                    <Label className="text-sm text-gray-500">Status Timeline</Label>
                    <div className="mt-2 space-y-2">
                      {getStatusTimeline(booking).map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${
                            STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-300'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.label || item.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {item.note && (
                              <p className="text-xs text-gray-600 mt-0.5">{item.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    {booking.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => handleAcceptBooking(booking)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Accept & Generate OTP
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleRejectBooking(booking)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}

                    {booking.status === 'confirmed' && (
                      <Button
                        onClick={() => handleStartService(booking)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        Start Service
                      </Button>
                    )}

                    {booking.status === 'in_progress' && (
                      <Button
                        onClick={() => handleCompleteService(booking)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Key className="w-4 h-4 mr-1" />
                        Complete Service (Verify OTP)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* OTP Verification Modal */}
      <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Completion OTP</DialogTitle>
            <DialogDescription>
              Ask the customer for the 6-digit completion OTP that was shared with them when the booking was confirmed.
              This verifies service completion and triggers revenue realization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="otp">Enter 6-Digit OTP from Customer</Label>
              <Input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                className="text-2xl text-center tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                The customer received this OTP when you accepted the booking
              </p>
            </div>

            {selectedBooking && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">Upon Verification:</p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                  <li>Booking status will be marked as "Completed"</li>
                  <li>Revenue will be realized: ₹{(selectedBooking.vendorEarnings || selectedBooking.price * 0.9).toFixed(2)}</li>
                  <li>Platform commission: ₹{(selectedBooking.platformCommission || selectedBooking.price * 0.1).toFixed(2)}</li>
                  <li>Payment will be processed to your account</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOTPModal(false);
                setOtpInput('');
              }}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              onClick={verifyCompletionOTP}
              disabled={verifying || otpInput.length !== 6}
              className="bg-green-600 hover:bg-green-700"
            >
              {verifying ? 'Verifying...' : 'Verify & Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Confirmed Modal (shows OTP to vendor) */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Confirmed! 🎉</DialogTitle>
            <DialogDescription>
              Completion OTP has been generated and sent to the customer
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && selectedBooking.completionOTP && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <Label className="text-sm font-medium text-orange-900">Completion OTP (Software Generated)</Label>
                <div className="flex items-center gap-3 mt-3">
                  <div className="bg-white border-2 border-orange-300 rounded-lg px-6 py-3">
                    <p className="text-3xl font-mono tracking-widest text-orange-600">
                      {selectedBooking.completionOTP}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => copyOTPToClipboard(selectedBooking.completionOTP!)}
                  >
                    {copiedOTP ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">Important:</p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                  <li>This OTP has been automatically sent to the customer</li>
                  <li>Customer will provide this OTP to you upon service completion</li>
                  <li>Enter this OTP to verify completion and realize revenue</li>
                  <li>OTP is valid for 24 hours</li>
                  <li>Keep this OTP secure - it triggers payment processing</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowConfirmModal(false)}>
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
