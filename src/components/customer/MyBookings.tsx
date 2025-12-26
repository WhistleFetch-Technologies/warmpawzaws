import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Clock, MapPin, Calendar, Check, X, Copy,
  AlertCircle, RefreshCw, Eye, EyeOff, Package, ChevronRight
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { copyTextToClipboard } from '../../utils/shareUtils';

import { BookingDetailModal } from './BookingDetailModal';

interface BookingOccurrence {
  occurrenceId: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  otp?: string;
  completedAt?: string;
  completedBy?: string;
}

interface Booking {
  bookingId: string;
  serviceType: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  staffId?: string;
  staffName?: string;
  petId: string;
  petName: string;
  customerPhone: string;
  serviceStyle: string;
  bookingDate: string;
  bookingTime: string;
  duration: number;
  price: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  completionOTP?: string;
  isPackage: boolean;
  packageDetails?: {
    totalSessions: number;
    completedSessions: number;
    frequency: string;
  };
  occurrences?: BookingOccurrence[];
  createdAt: string;
  specialInstructions?: string;
  requiresStartOTP?: boolean;
  startOTP?: string;
  startTime?: string;
  endTime?: string;
  actualDuration?: number;
}

interface MyBookingsProps {
  phone: string;
  onBack: () => void;
  initialBookingId?: string; // To open a specific booking
  onReorderMedicine?: (medications: any[]) => void;
}

export function MyBookings({ phone, onBack, initialBookingId, onReorderMedicine }: MyBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [showOTP, setShowOTP] = useState<string | null>(null);
  const [copiedOTP, setCopiedOTP] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    resolveCustomerId();
  }, [phone]);

  useEffect(() => {
    if (customerId) {
      loadBookings();
    }
  }, [customerId]);

  useEffect(() => {
    if (initialBookingId && bookings.length > 0) {
      const booking = bookings.find(b => b.bookingId === initialBookingId);
      if (booking) {
        setSelectedBooking(booking);
      }
    }
  }, [initialBookingId, bookings]);

  const resolveCustomerId = async () => {
    try {
      const response = await fetch(`${API_BASE}/customer-by-phone/${phone}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId || phone);
      } else {
        // Fallback to phone if resolution fails
        setCustomerId(phone);
      }
    } catch (error) {
      console.error('Error resolving customerId:', error);
      // Fallback to phone
      setCustomerId(phone);
    }
  };

  const loadBookings = async () => {
    if (!customerId) return;
    
    try {
      setLoading(true);
      // ✅ FIX: Use SQL-migrated appointment endpoint
      const response = await fetch(
        `${API_BASE}/appointments/customer/${customerId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Map appointments to bookings format for compatibility
        const mappedBookings = (result.appointments || []).map((apt: any) => ({
          bookingId: apt.id || apt.appointmentId,
          serviceType: apt.serviceType || apt.service_type,
          serviceName: apt.serviceName || apt.service_name,
          vendorId: apt.vendorId || apt.vendor_id,
          vendorName: apt.vendorName || apt.vendor_name,
          staffId: apt.staffId || apt.staff_id,
          staffName: apt.staffName || apt.staff_name,
          petId: apt.petId || apt.pet_id,
          petName: apt.petName || apt.pet_name,
          customerPhone: phone,
          serviceStyle: apt.serviceStyle || apt.service_style,
          bookingDate: apt.scheduledDate || apt.scheduled_date || apt.bookingDate,
          bookingTime: apt.scheduledTime || apt.scheduled_time || apt.bookingTime,
          duration: apt.duration || 60,
          price: apt.price || apt.totalAmount || 0,
          status: apt.status || 'pending',
          completionOTP: apt.completionOTP,
          isPackage: apt.isPackage || false,
          packageDetails: apt.packageDetails,
          occurrences: apt.occurrences,
          createdAt: apt.createdAt || apt.created_at,
          specialInstructions: apt.specialInstructions || apt.special_instructions,
          requiresStartOTP: apt.requiresStartOTP,
          startOTP: apt.startOTP,
          startTime: apt.startTime,
          endTime: apt.endTime,
          actualDuration: apt.actualDuration,
        }));
        setBookings(mappedBookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyOTP = (otp: string, id: string) => {
    copyTextToClipboard(otp);
    setCopiedOTP(id);
    setTimeout(() => setCopiedOTP(null), 2000);
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') {
      return booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress';
    }
    if (activeFilter === 'completed') {
      return booking.status === 'completed';
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  if (selectedBooking) {
    return (
      <BookingDetailModal
        bookingId={selectedBooking.bookingId}
        petId={selectedBooking.petId}
        phone={phone}
        onClose={() => setSelectedBooking(null)}
        onReorderMedicine={onReorderMedicine}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center justify-between p-4 max-w-[430px] mx-auto">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">My Bookings</h1>
          <button onClick={loadBookings} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 pb-3 max-w-[430px] mx-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${
                activeFilter === tab.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="max-w-[430px] mx-auto p-4 space-y-3 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No bookings found</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeFilter === 'all' ? 'Book your first service to get started!' : `No ${activeFilter} bookings`}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div
              key={booking.bookingId}
              onClick={() => setSelectedBooking(booking)}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#FF8C42] cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{booking.serviceName}</h3>
                  <p className="text-sm text-gray-600">{booking.vendorName}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                  {getStatusText(booking.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(booking.bookingDate).toLocaleDateString()} at {booking.bookingTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="capitalize">{booking.serviceStyle.replace('_', ' ')}</span>
                </div>
              </div>

              {booking.isPackage && booking.packageDetails && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-600">
                    {booking.packageDetails.completedSessions}/{booking.packageDetails.totalSessions} sessions completed
                  </span>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="font-medium">₹{booking.price}</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}