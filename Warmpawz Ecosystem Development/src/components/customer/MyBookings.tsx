import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Clock, MapPin, Calendar, Check, X, Copy,
  AlertCircle, RefreshCw, Eye, EyeOff, Package, ChevronRight,
  Phone, Navigation, Star, MessageSquare, User
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { copyTextToClipboard } from '../../utils/shareUtils';
import { Badge } from '../ui/badge';

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
  vendorPhone?: string;
  vendorAddress?: string;
  vendorLatitude?: number;
  vendorLongitude?: number;
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
  hasReview?: boolean;
  rating?: number;
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

  useEffect(() => {
    loadBookings();
  }, [phone]);

  useEffect(() => {
    if (initialBookingId && bookings.length > 0) {
      const booking = bookings.find(b => b.bookingId === initialBookingId);
      if (booking) {
        setSelectedBooking(booking);
      }
    }
  }, [initialBookingId, bookings]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/customer/${phone}/bookings`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBookings(result.bookings || []);
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
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#FF8C42] transition-colors shadow-sm"
            >
              {/* Header Row - Click to open details */}
              <div 
                onClick={() => setSelectedBooking(booking)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{booking.serviceName}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {booking.vendorName}
                    </p>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                    {getStatusText(booking.status)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#FF8C42]" />
                    <span>{new Date(booking.bookingDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {booking.bookingTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#FF8C42]" />
                    <span className="capitalize">{booking.serviceStyle.replace('_', ' ')}</span>
                    {booking.vendorAddress && (
                      <span className="text-gray-400 text-xs truncate max-w-[150px]">• {booking.vendorAddress}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF8C42]" />
                    <span>Pet: {booking.petName}</span>
                  </div>
                </div>

                {booking.isPackage && booking.packageDetails && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span className="text-purple-600 font-medium">
                      {booking.packageDetails.completedSessions}/{booking.packageDetails.totalSessions} sessions completed
                    </span>
                  </div>
                )}
              </div>

              {/* OTP Section - For upcoming/confirmed bookings */}
              {booking.completionOTP && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">OTP</span>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 font-medium">Service Completion OTP</p>
                        <p className="text-xl font-bold text-purple-700 tracking-wider">
                          {showOTP === booking.bookingId ? booking.completionOTP : '••••••'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOTP(showOTP === booking.bookingId ? null : booking.bookingId);
                        }}
                        className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        {showOTP === booking.bookingId ? (
                          <EyeOff className="w-4 h-4 text-purple-600" />
                        ) : (
                          <Eye className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (booking.completionOTP) {
                            copyOTP(booking.completionOTP, booking.bookingId);
                          }
                        }}
                        className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        {copiedOTP === booking.bookingId ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 mt-2 text-center">
                    Share this OTP with the service provider after completion
                  </p>
                </div>
              )}

              {/* Quick Actions Row */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-lg text-gray-900">₹{booking.price}</span>
                  <button
                    onClick={() => setSelectedBooking(booking)}
                    className="text-sm text-[#FF8C42] font-medium flex items-center gap-1 hover:underline"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {/* Call Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const phoneNumber = booking.vendorPhone || '+911234567890';
                      window.location.href = `tel:${phoneNumber}`;
                    }}
                    className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </button>

                  {/* Directions Button - Only for at_center services */}
                  {booking.serviceStyle === 'at_center' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open Google Maps with directions
                        const destination = booking.vendorLatitude && booking.vendorLongitude
                          ? `${booking.vendorLatitude},${booking.vendorLongitude}`
                          : encodeURIComponent(booking.vendorAddress || booking.vendorName);
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                      }}
                      className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors border border-green-200"
                    >
                      <Navigation className="w-4 h-4" />
                      Directions
                    </button>
                  )}

                  {/* Chat Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBooking(booking);
                    }}
                    className="flex-1 py-2.5 bg-orange-50 text-[#FF8C42] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-orange-100 transition-colors border border-orange-200"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </button>

                  {/* Review Button - Only for completed bookings without review */}
                  {booking.status === 'completed' && !booking.hasReview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBooking(booking);
                        // TODO: Open review modal directly
                      }}
                      className="flex-1 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors border border-amber-200"
                    >
                      <Star className="w-4 h-4" />
                      Review
                    </button>
                  )}

                  {/* Show rating if already reviewed */}
                  {booking.status === 'completed' && booking.hasReview && booking.rating && (
                    <div className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border border-gray-200">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      {booking.rating}/5
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}