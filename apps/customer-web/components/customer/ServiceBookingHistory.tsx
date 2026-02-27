'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Package, Download, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { BookingDetailModal } from './BookingDetailModal';

interface ServiceBookingHistoryProps {
  phone: string;
  serviceType: string; // 'vet', 'grooming', 'training', etc.
  serviceName: string; // 'Vet Services', 'Grooming Services', etc.
  onClose: () => void;
}

interface Booking {
  id: string;
  serviceType: string;
  serviceName: string;
  serviceStyle: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  petName: string;
  petId: string;
  vendorName: string;
  price: number;
  completionOTP?: string;
  requiresOTP: boolean;
  otpVerifiedAt?: string;
  createdAt: string;
}

export function ServiceBookingHistory({ phone, serviceType, serviceName, onClose }: ServiceBookingHistoryProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  useEffect(() => {
    loadServiceBookings();
  }, [phone, serviceType]);

  const loadServiceBookings = async () => {
    try {
      setLoading(true);
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      
      const data = await apiClient.get<{ bookings?: Booking[] }>(`/customer/bookings?phone=${cleanPhone}&serviceType=${serviceType}`);
      
      // Filter bookings by service type
      const serviceBookings = (data.bookings || []).filter((b: Booking) => 
        b.serviceType === serviceType
      );
      
      // Sort by date (newest first)
      serviceBookings.sort((a: Booking, b: Booking) => {
        const dateA = new Date(a.scheduledDate || a.createdAt);
        const dateB = new Date(b.scheduledDate || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      setBookings(serviceBookings);
      console.log(`✅ Loaded ${serviceBookings.length} ${serviceType} bookings`);
    } catch (error) {
      console.error('Error loading service bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress':
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getServiceEmoji = (type: string) => {
    switch (type) {
      case 'vet':
        return '🏥';
      case 'grooming':
        return '✂️';
      case 'training':
        return '🎓';
      case 'boarding':
        return '🏠';
      case 'walker':
        return '🐕';
      case 'adoption':
        return '🐾';
      case 'sunset':
        return '🌅';
      case 'insurance':
        return '🛡️';
      default:
        return '🐾';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const handleDownloadInvoice = async (booking: Booking) => {
    try {
      const apiBaseUrl = (apiClient as any)['baseUrl'] || process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
      const url = `${apiBaseUrl}/bookings/${booking.id}/invoice`;
      
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `invoice-${booking.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('Invoice downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice. Please try again later.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div 
          className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 rounded-t-[32px] z-10">
            {/* ✅ FIX: Replace X close button with Back button */}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-800 flex-1">My {serviceName} Bookings</h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="text-6xl mb-4">{getServiceEmoji(serviceType)}</div>
              <h3 className="font-bold text-gray-800 mb-2">No {serviceName} Bookings</h3>
              <p className="text-gray-600 text-center text-sm">
                You haven't booked any {serviceName.toLowerCase()} yet.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4 pb-24">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="font-bold text-gray-900">{bookings.length}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="font-bold text-green-700">
                    {bookings.filter(b => b.status === 'completed').length}
                  </div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="font-bold text-blue-700">
                    {bookings.filter(b => b.status === 'confirmed' || b.status === 'in_progress').length}
                  </div>
                  <div className="text-xs text-gray-600">Upcoming</div>
                </div>
              </div>

              {/* Bookings List */}
              {bookings.map((booking) => (
                <div 
                  key={booking.id} 
                  className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedBookingId(booking.id);
                    setSelectedPetId(booking.petId);
                  }}
                >
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                      {booking.status === 'in_progress' ? 'In Progress' : 
                       booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">#{booking.id.slice(-6)}</span>
                  </div>

                  {/* Service Info */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {getServiceEmoji(serviceType)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{booking.serviceName}</h4>
                      <p className="text-sm text-gray-600">
                        {booking.petName} • {booking.serviceStyle?.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#FF8C42]">₹{booking.price}</p>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{formatDate(booking.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{booking.scheduledTime || 'Not set'}</span>
                    </div>
                  </div>

                  {/* Vendor */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{booking.vendorName}</span>
                  </div>

                  {/* OTP or Completion Info */}
                  {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.requiresOTP && booking.completionOTP && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3">
                      <p className="text-xs text-orange-800 flex items-center gap-1">
                        🔐 <strong>OTP:</strong> 
                        <span className="font-mono font-bold tracking-wider ml-1">{booking.completionOTP}</span>
                      </p>
                    </div>
                  )}

                  {booking.status === 'completed' && booking.otpVerifiedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
                      <p className="text-xs text-green-800 flex items-center gap-1">
                        ✓ Completed on {formatDate(booking.otpVerifiedAt)}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    {booking.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(booking);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-9"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Invoice
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setSelectedBookingId(booking.id);
                        setSelectedPetId(booking.petId);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-9"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      View Details
                      <ChevronRight className="w-3 h-3 ml-auto" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Home Indicator */}
          <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-center">
            <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
          </div>
        </div>

        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>

      {/* Booking Detail Modal */}
      {selectedBookingId && selectedPetId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          petId={selectedPetId}
          phone={phone}
          onClose={() => {
            setSelectedBookingId(null);
            setSelectedPetId(null);
            loadServiceBookings(); // Reload in case changes were made
          }}
        />
      )}
    </>
  );
}
