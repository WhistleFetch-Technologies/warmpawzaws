'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Calendar, 
  DollarSign, 
  MessageSquare, 
  Settings, 
  MapPin, 
  Clock,
  LogOut,
  User,
  Package,
  Navigation,
  CheckCircle2,
  Video,
  Home,
  Monitor,
  RefreshCw,
  Bell,
  X,
  Play,
  Radio,
  Map
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { InstantTeleQueueWidget } from '@/components/staff/InstantTeleQueueWidget';
import { DashboardStats } from '@/components/shared/DashboardStats';
import { AppointmentCard } from '@/components/shared/AppointmentCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ScheduleItem {
  id: string;
  bookingId: string;
  time: string;
  duration: number;
  petName: string;
  petBreed?: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceType: string;
  status: string;
  price: number;
  address: string;
  customerLat?: string;
  customerLng?: string;
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  otp?: string;
}

// Helper to format booking time
function formatBookingTime(time: string): string {
  if (!time) return 'N/A';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function StaffDashboardPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    completedServices: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<'all' | 'home' | 'tele' | 'center'>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // OTP modal for completing appointments
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processingOtp, setProcessingOtp] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete'>('complete');
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduleItem | null>(null);
  
  // GPS tracking state
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({});
  const [trackingLocation, setTrackingLocation] = useState<{ [key: string]: { lat: number; lng: number; updated: string } }>({});

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (!staffSession) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffData = JSON.parse(staffSession);
        setStaff(staffData);
        fetchDashboardData(staffData.id);
      } catch (error) {
        console.error('Error parsing staff session:', error);
        router.push('/staff/login');
      }
    }
  }, [router]);

  const fetchDashboardData = useCallback(async (staffId: string, showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      // Load today's appointments
      const today = new Date().toISOString().split('T')[0];
      const appointmentsRes = await apiClient.get<any>(`/staff/${staffId}/appointments?date=${today}`).catch(() => ({ success: false, appointments: [] }));
      
      if (appointmentsRes && appointmentsRes.success) {
        const appointments = appointmentsRes.appointments || [];
        
        // Transform bookings
        const transformedBookings: ScheduleItem[] = appointments.map((b: any) => ({
          id: b.id || b.booking_id,
          bookingId: b.id || b.booking_id,
          time: b.booking_time ? formatBookingTime(b.booking_time) : 'N/A',
          duration: b.duration_minutes || 30,
          petName: b.pet_name || 'Pet',
          petBreed: b.pet_breed,
          customerName: b.customer_name || 'Customer',
          customerPhone: b.customer_phone || '',
          serviceName: b.service_name || 'Service',
          serviceType: b.service_style || b.service_type || 'at_home',
          status: b.status || 'pending',
          price: parseFloat(b.total_amount || '0'),
          address: b.customer_address || b.address || '',
          customerLat: b.customer_lat,
          customerLng: b.customer_lng,
          hasUnreadMessages: b.hasUnreadMessages || false,
          unreadMessageCount: b.unreadMessageCount || 0,
          chatEnabled: b.chatEnabled !== false,
          otp: b.otp,
        }));
        setTodaySchedule(transformedBookings);

        // Calculate stats
        const teleCount = transformedBookings.filter((a: ScheduleItem) => 
          a.serviceType?.toLowerCase() === 'tele' || a.serviceType?.toLowerCase() === 'teleconsultation'
        ).length;

        setStats({
          appointments: transformedBookings.length,
          consultations: teleCount,
          earnings: 0, // TODO: Implement earnings endpoint
          completedServices: transformedBookings.filter((a: ScheduleItem) => a.status === 'completed').length,
        });
      }

      // Load notifications (if endpoint exists)
      const notificationsRes = await apiClient.get<any>(`/staff/${staffId}/notifications?limit=5`).catch(() => ({ success: false, notifications: [] }));
      if (notificationsRes && notificationsRes.success) {
        setNotifications(notificationsRes.notifications || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // GPS tracking functions
  const startLocationTracking = async (bookingId: string, customerLat: string, customerLng: string) => {
    if (!staff) return;

    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            // Start location sharing
            const appointment = todaySchedule.find(a => a.bookingId === bookingId);
            await apiClient.post<any>('/location/start-sharing', {
              bookingId,
              vendorId: staff.vendor_id || staff.id,
              customerId: (appointment as any)?.customerId || 'unknown',
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

  // OTP handler for starting/completing appointments
  const handleOtpAction = async () => {
    if (!selectedAppointment || !staff) return;
    if (otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessingOtp(true);
    setOtpError(null);

    try {
      if (otpAction === 'start') {
        const data = await apiClient.put<any>(`/staff/${staff.id}/appointments/${selectedAppointment.bookingId}/start`, {
          otp,
        });
        
        if (data.success) {
          // Start GPS tracking for at_home services
          const serviceType = selectedAppointment.serviceType?.toLowerCase();
          if (serviceType === 'at_home' || serviceType === 'home') {
            const lat = selectedAppointment.customerLat;
            const lng = selectedAppointment.customerLng;
            if (lat && lng) {
              await startLocationTracking(selectedAppointment.bookingId, lat, lng);
            }
          }
          toast.success('Service started successfully!');
        } else {
          throw new Error(data.error || 'Failed to start service');
        }
      } else if (otpAction === 'complete') {
        const data = await apiClient.put<any>(`/staff/${staff.id}/appointments/${selectedAppointment.bookingId}/complete`, {
          otp,
        });
        
        if (data.success) {
          // Stop GPS tracking if active
          if (isTracking[selectedAppointment.bookingId]) {
            await stopLocationTracking(selectedAppointment.bookingId);
          }
          toast.success('Service completed successfully!');
        } else {
          throw new Error(data.error || 'Failed to complete service');
        }
      }
      
      setShowOtpModal(false);
      setOtp('');
      setOtpError(null);
      setSelectedAppointment(null);
      fetchDashboardData(staff.id, true);
    } catch (error: any) {
      console.error(`Error ${otpAction === 'start' ? 'starting' : 'completing'} service:`, error);
      setOtpError(error.message || `OTP verification failed. Please try again.`);
    } finally {
      setProcessingOtp(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('staff_session');
      localStorage.removeItem('staff_id');
      router.push('/staff/login');
      toast.success('Logged out successfully');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  const menuItems = [
    {
      title: 'Appointments',
      description: 'View and manage bookings',
      icon: Calendar,
      href: '/staff/appointments',
      color: 'bg-blue-500',
    },
    {
      title: 'Services',
      description: 'Manage your services',
      icon: Package,
      href: '/staff/services',
      color: 'bg-green-500',
    },
    {
      title: 'Schedule',
      description: 'Set your availability',
      icon: Clock,
      href: '/staff/schedule',
      color: 'bg-purple-500',
    },
    {
      title: 'Location',
      description: 'Set your service location',
      icon: MapPin,
      href: '/staff/location',
      color: 'bg-orange-500',
    },
    {
      title: 'Messages',
      description: 'Chat with customers',
      icon: MessageSquare,
      href: '/staff/messages',
      color: 'bg-pink-500',
    },
    {
      title: 'Earnings',
      description: 'View revenue and settlements',
      icon: DollarSign,
      href: '/staff/earnings',
      color: 'bg-yellow-500',
    },
    {
      title: 'Profile',
      description: 'Update your profile',
      icon: User,
      href: '/staff/profile',
      color: 'bg-indigo-500',
    },
    {
      title: 'Settings',
      description: 'Account settings',
      icon: Settings,
      href: '/staff/settings',
      color: 'bg-gray-500',
    },
    {
      title: 'Instant Tele',
      description: 'Queue management',
      icon: Video,
      href: '/staff/instant-tele',
      color: 'bg-indigo-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {staff.photo ? (
              <img
                src={staff.photo}
                alt={staff.name}
                className="w-12 h-12 rounded-full border-2 border-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Welcome, {staff.name}</h1>
              <p className="text-sm text-white/90">
                {staff.isIndividualProvider ? 'Individual Provider' : staff.vendor?.businessName || 'Staff Member'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards - Using shared DashboardStats component */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Dashboard Overview</h2>
          <button 
            onClick={() => staff && fetchDashboardData(staff.id, true)} 
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <DashboardStats
          stats={stats}
          onStatClick={(statType) => {
            if (statType === 'appointments' || statType === 'consultations') {
              router.push('/staff/appointments');
            } else if (statType === 'earnings') {
              router.push('/staff/earnings');
            }
          }}
          className="mb-6"
        />

        {/* Today's Schedule - Using shared AppointmentCard component */}
        {todaySchedule.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              <button 
                onClick={() => router.push('/staff/appointments')}
                className="text-sm text-[#FF8C42] hover:underline"
              >
                View All →
              </button>
            </div>

            {/* Service Style Filter */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              <button 
                onClick={() => setAppointmentTypeFilter('all')} 
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  appointmentTypeFilter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                All Types
              </button>
              <button 
                onClick={() => setAppointmentTypeFilter('home')} 
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  appointmentTypeFilter === 'home' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Home className="w-3.5 h-3.5" /> Home Visit
              </button>
              <button 
                onClick={() => setAppointmentTypeFilter('tele')} 
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  appointmentTypeFilter === 'tele' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Tele
              </button>
              <button 
                onClick={() => setAppointmentTypeFilter('center')} 
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  appointmentTypeFilter === 'center' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> At Center
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {todaySchedule
                .filter(appointment => {
                  if (appointmentTypeFilter === 'all') return true;
                  const typeMap: Record<string, string> = {
                    'at_home': 'home',
                    'home': 'home',
                    'tele': 'tele',
                    'teleconsultation': 'tele',
                    'at_center': 'center',
                    'at_clinic': 'center'
                  };
                  return typeMap[appointment.serviceType?.toLowerCase()] === appointmentTypeFilter;
                })
                .map(appointment => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onViewDetails={(bookingId) => {
                      router.push(`/staff/appointments?bookingId=${bookingId}`);
                    }}
                    onCall={(phone) => window.location.href = `tel:${phone}`}
                    onChat={(bookingId) => {
                      router.push(`/staff/messages?bookingId=${bookingId}`);
                    }}
                    onStart={(bookingId) => {
                      const apt = todaySchedule.find(a => a.bookingId === bookingId);
                      if (apt) {
                        setSelectedAppointment(apt);
                        setOtpAction('start');
                        setShowOtpModal(true);
                        setOtp('');
                        setOtpError(null);
                      }
                    }}
                    onComplete={(bookingId) => {
                      const apt = todaySchedule.find(a => a.bookingId === bookingId);
                      if (apt) {
                        setSelectedAppointment(apt);
                        setOtpAction('complete');
                        setShowOtpModal(true);
                        setOtp('');
                        setOtpError(null);
                      }
                    }}
                    onNavigate={(lat, lng) => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                      window.open(url, '_blank');
                    }}
                    onStartGPS={(bookingId) => {
                      const apt = todaySchedule.find(a => a.bookingId === bookingId);
                      if (apt && apt.customerLat && apt.customerLng) {
                        startLocationTracking(bookingId, apt.customerLat, apt.customerLng);
                      }
                    }}
                    onStopGPS={(bookingId) => stopLocationTracking(bookingId)}
                    isTracking={isTracking[appointment.bookingId] || false}
                    showActions={true}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Instant Tele Queue Widget */}
        {staff && (
          <div className="mb-6">
            <InstantTeleQueueWidget staffId={staff.id} />
          </div>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-xs text-gray-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {otpAction === 'start' ? 'Start Service' : 'Complete Service'}
              </h3>
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                  setSelectedAppointment(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ask the customer for the 6-digit OTP sent to their phone to {otpAction === 'start' ? 'start' : 'complete'} the service.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                maxLength={6}
                autoFocus
              />
              {otpError && (
                <p className="text-sm text-red-600 mt-2">{otpError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                  setSelectedAppointment(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processingOtp}
              >
                Cancel
              </button>
              <button
                onClick={handleOtpAction}
                disabled={otp.length !== 6 || processingOtp}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  otpAction === 'start' 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {processingOtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & {otpAction === 'start' ? 'Start' : 'Complete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
