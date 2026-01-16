'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Home, 
  Video,
  CheckCircle,
  XCircle,
  Play,
  Square,
  MessageSquare,
  Navigation,
  Loader2,
  AlertCircle,
  User,
  Package,
  Map,
  MapPin as MapPinIcon,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Appointment {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  service_style: string;
  otp?: string;
  customer_address?: string;
  customer_lat?: string;
  customer_lng?: string;
  service_name: string;
  service_description?: string;
  customer_name: string;
  customer_phone: string;
  pet_name: string;
  pet_type: string;
  vendor_name?: string;
  distance?: number;
}

export default function StaffAppointmentsPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [completingBooking, setCompletingBooking] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [actionType, setActionType] = useState<'start' | 'complete' | null>(null);
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({});
  const [trackingLocation, setTrackingLocation] = useState<{ [key: string]: { lat: number; lng: number; updated: string } }>({});

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        try {
          const staffData = JSON.parse(staffSession);
          setStaff(staffData);
          loadAppointments(staffData.id);
        } catch (error) {
          console.error('Error parsing staff session:', error);
          router.push('/staff/login');
        }
      } else {
        router.push('/staff/login');
      }
    }
  }, [router, filter, selectedDate]);

  const loadAppointments = async (staffId: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('date', selectedDate);
      if (filter !== 'all') {
        params.append('status', filter);
      }

      const response = await apiClient.get<any>(`/staff/${staffId}/appointments?${params.toString()}`);
      
      if (response.success) {
        setAppointments(response.appointments || []);
      } else {
        throw new Error(response.error || 'Failed to load appointments');
      }
    } catch (error: any) {
      console.error('[APPOINTMENTS] Error:', error);
      toast.error(error.message || 'Failed to load appointments');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (appointment: Appointment) => {
    try {
      const response = await apiClient.put<any>(`/staff/${staff.id}/appointments/${appointment.id}/accept`);
      if (response.success) {
        toast.success('Booking accepted');
        await loadAppointments(staff.id);
      } else {
        throw new Error(response.error || 'Failed to accept booking');
      }
    } catch (error: any) {
      console.error('[ACCEPT] Error:', error);
      toast.error(error.message || 'Failed to accept booking');
    }
  };

  const handleReject = async (appointment: Appointment) => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      const response = await apiClient.put<any>(`/staff/${staff.id}/appointments/${appointment.id}/reject`, { reason });
      if (response.success) {
        toast.success('Booking rejected');
        await loadAppointments(staff.id);
      } else {
        throw new Error(response.error || 'Failed to reject booking');
      }
    } catch (error: any) {
      console.error('[REJECT] Error:', error);
      toast.error(error.message || 'Failed to reject booking');
    }
  };

  const handleStart = async (appointment: Appointment) => {
    // For at_home and at_center, require OTP
    if (appointment.service_style !== 'tele' && appointment.otp) {
      setCompletingBooking(appointment.id);
      setActionType('start');
      setOtp('');
      setShowOtpDialog(true);
    } else {
      // Tele services don't need OTP
      await doStart(appointment, '');
    }
  };

  const doStart = async (appointment: Appointment, otpCode: string) => {
    try {
      const response = await apiClient.put<any>(`/staff/${staff.id}/appointments/${appointment.id}/start`, { otp: otpCode });
      if (response.success) {
        toast.success('Service started' + (response.gpsTrackingEnabled ? ' - GPS tracking enabled' : ''));
        setShowOtpDialog(false);
        setCompletingBooking(null);
        
        // Start GPS tracking for at_home services
        if (appointment.service_style === 'at_home' && appointment.customer_lat && appointment.customer_lng) {
          startLocationTracking(appointment.id, appointment.customer_lat, appointment.customer_lng);
        }
        
        await loadAppointments(staff.id);
      } else {
        throw new Error(response.error || 'Failed to start service');
      }
    } catch (error: any) {
      console.error('[START] Error:', error);
      toast.error(error.message || 'Failed to start service');
    }
  };

  const startLocationTracking = async (bookingId: string, customerLat: string, customerLng: string) => {
    if (!staff) return;

    try {
      // Request location permission and get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            // Start location sharing
            const booking = appointments.find(a => a.id === bookingId);
            await apiClient.post<any>('/location/start-sharing', {
              bookingId,
              vendorId: staff.vendor_id || staff.id,
              customerId: (booking as any)?.customer_id || 'unknown',
              location,
            });

            setIsTracking(prev => ({ ...prev, [bookingId]: true }));
            setTrackingLocation(prev => ({
              ...prev,
              [bookingId]: {
                lat: location.latitude,
                lng: location.longitude,
                updated: new Date().toISOString(),
              },
            }));

            // Update location every 30 seconds
            const interval = setInterval(async () => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const loc = {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    };

                    try {
                      await apiClient.post<any>('/location/update', {
                        bookingId,
                        location: loc,
                      });

                      setTrackingLocation(prev => ({
                        ...prev,
                        [bookingId]: {
                          lat: loc.latitude,
                          lng: loc.longitude,
                          updated: new Date().toISOString(),
                        },
                      }));
                    } catch (error) {
                      console.error('Error updating location:', error);
                    }
                  },
                  (error) => {
                    console.error('Error getting location:', error);
                  }
                );
              }
            }, 30000);

            // Store interval ID for cleanup
            (window as any)[`tracking_${bookingId}`] = interval;
          },
          (error) => {
            console.error('Error getting location:', error);
            toast.error('Location permission denied. GPS tracking disabled.');
          }
        );
      }
    } catch (error: any) {
      console.error('Error starting location tracking:', error);
      toast.error('Failed to start GPS tracking');
    }
  };

  const stopLocationTracking = async (bookingId: string) => {
    try {
      await apiClient.post<any>('/location/stop-sharing', { bookingId });
      
      // Clear interval
      const interval = (window as any)[`tracking_${bookingId}`];
      if (interval) {
        clearInterval(interval);
        delete (window as any)[`tracking_${bookingId}`];
      }

      setIsTracking(prev => {
        const newState = { ...prev };
        delete newState[bookingId];
        return newState;
      });
      
      setTrackingLocation(prev => {
        const newState = { ...prev };
        delete newState[bookingId];
        return newState;
      });

      toast.success('GPS tracking stopped');
    } catch (error: any) {
      console.error('Error stopping location tracking:', error);
    }
  };

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      Object.keys(isTracking).forEach(bookingId => {
        const interval = (window as any)[`tracking_${bookingId}`];
        if (interval) {
          clearInterval(interval);
        }
      });
    };
  }, []);

  const handleComplete = async (appointment: Appointment) => {
    // For at_home and at_center, require OTP
    if (appointment.service_style !== 'tele' && appointment.otp) {
      setCompletingBooking(appointment.id);
      setActionType('complete');
      setOtp('');
      setShowOtpDialog(true);
    } else {
      // Tele services don't need OTP
      await doComplete(appointment, '');
    }
  };

  const doComplete = async (appointment: Appointment, otpCode: string) => {
    try {
      const response = await apiClient.put<any>(`/staff/${staff.id}/appointments/${appointment.id}/complete`, { otp: otpCode });
      if (response.success) {
        toast.success('Service completed successfully!');
        setShowOtpDialog(false);
        setCompletingBooking(null);
        await loadAppointments(staff.id);
      } else {
        throw new Error(response.error || 'Failed to complete service');
      }
    } catch (error: any) {
      console.error('[COMPLETE] Error:', error);
      toast.error(error.message || 'Failed to complete service');
    }
  };

  const handleSubmitOtp = () => {
    if (!completingBooking || !otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    const appointment = appointments.find(a => a.id === completingBooking);
    if (!appointment) {
      toast.error('Appointment not found');
      return;
    }

    if (actionType === 'start') {
      doStart(appointment, otp);
    } else if (actionType === 'complete') {
      doComplete(appointment, otp);
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

  const getServiceStyleIcon = (style: string) => {
    switch (style) {
      case 'at_home': return <Home className="w-4 h-4" />;
      case 'tele': return <Video className="w-4 h-4" />;
      case 'at_center': return <MapPin className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  const filteredAppointments = appointments;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const todayCount = appointments.filter(a => a.booking_date === selectedDate).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">My Appointments</h1>
              <p className="text-sm text-gray-600">Manage your bookings</p>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label htmlFor="date" className="text-sm font-medium text-gray-700 mb-1 block">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All ({appointments.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'pending' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('confirmed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'confirmed' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setFilter('in_progress')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'in_progress' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'completed' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="p-4 space-y-3">
          {filteredAppointments.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Appointments</h3>
              <p className="text-sm text-gray-600">
                {filter === 'all' 
                  ? 'No appointments found for selected date'
                  : `No ${filter} appointments found`}
              </p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white rounded-xl border-2 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold text-gray-900">
                        {appointment.booking_time}
                      </span>
                      <Badge className={getStatusColor(appointment.status)}>
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                      <div className="flex items-center gap-1 text-gray-500">
                        {getServiceStyleIcon(appointment.service_style)}
                        <span className="text-xs">{appointment.service_style}</span>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{appointment.customer_name}</span>
                        <span className="text-xs text-gray-500">({appointment.customer_phone})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🐕</span>
                        <span className="text-sm text-gray-700">{appointment.pet_name} - {appointment.pet_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-[#FF8C42]">{appointment.service_name}</span>
                      </div>
                      {appointment.customer_address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{appointment.customer_address}</span>
                          {appointment.distance && (
                            <Badge variant="outline" className="text-xs">
                              {appointment.distance.toFixed(1)} km away
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">₹{appointment.total_amount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {appointment.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => handleAccept(appointment)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept
                      </Button>
                      <Button
                        onClick={() => handleReject(appointment)}
                        variant="outline"
                        className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                        size="sm"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}

                  {appointment.status === 'confirmed' && (
                    <Button
                      onClick={() => handleStart(appointment)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Service
                    </Button>
                  )}

                  {appointment.status === 'in_progress' && (
                    <>
                      {appointment.service_style === 'at_home' && (
                        <>
                          <Button
                            onClick={() => {
                              // Open navigation/map
                              if (appointment.customer_lat && appointment.customer_lng) {
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${appointment.customer_lat},${appointment.customer_lng}`;
                                window.open(url, '_blank');
                              }
                            }}
                            variant="outline"
                            className="flex-1"
                            size="sm"
                          >
                            <Navigation className="w-4 h-4 mr-2" />
                            Navigate
                          </Button>
                          {isTracking[appointment.id] ? (
                            <Button
                              onClick={() => stopLocationTracking(appointment.id)}
                              variant="outline"
                              className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                              size="sm"
                            >
                              <Radio className="w-4 h-4 mr-2" />
                              Stop GPS
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                if (appointment.customer_lat && appointment.customer_lng) {
                                  startLocationTracking(appointment.id, appointment.customer_lat, appointment.customer_lng);
                                }
                              }}
                              variant="outline"
                              className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                              size="sm"
                            >
                              <Map className="w-4 h-4 mr-2" />
                              Start GPS
                            </Button>
                          )}
                          {trackingLocation[appointment.id] && (
                            <div className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                              <div className="flex items-center gap-2">
                                <MapPinIcon className="w-3 h-3" />
                                <span>Location updated: {new Date(trackingLocation[appointment.id].updated).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <Button
                        onClick={() => handleComplete(appointment)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete
                      </Button>
                    </>
                  )}

                  {appointment.status === 'completed' && (
                    <div className="w-full p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-800 text-center">
                        ✅ Service completed successfully
                      </p>
                    </div>
                  )}

                  {/* Chat Button (always available for active bookings) */}
                  {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                    <Button
                      onClick={() => {
                        router.push(`/staff/messages?booking=${appointment.id}`);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* OTP Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'start' ? 'Start Service' : 'Complete Service'}
            </DialogTitle>
            <DialogDescription>
              Enter the OTP provided by the customer to {actionType === 'start' ? 'start' : 'complete'} the service
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {completingBooking && (() => {
              const appointment = appointments.find(a => a.id === completingBooking);
              return appointment ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Service:</strong> {appointment.service_name}
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Customer:</strong> {appointment.customer_name}
                  </p>
                  {appointment.otp && (
                    <p className="text-xs text-blue-600 mt-1">
                      Customer OTP: <strong>{appointment.otp}</strong>
                    </p>
                  )}
                </div>
              ) : null;
            })()}

            <div>
              <Label htmlFor="otp" className="text-sm font-medium text-gray-700 mb-2 block">
                Enter OTP
              </Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="h-12 text-2xl text-center tracking-widest font-mono"
                maxLength={6}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOtpDialog(false);
                setCompletingBooking(null);
                setOtp('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOtp}
              disabled={otp.length !== 6}
              className="bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              {actionType === 'start' ? 'Start Service' : 'Complete Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
