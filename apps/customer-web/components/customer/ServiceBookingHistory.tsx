'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Package, Download, FileText, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { BookingDetailModal } from './BookingDetailModal';

interface ServiceBookingHistoryProps {
  phone: string;
  serviceType: string;
  serviceName: string;
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
      
      const response = await apiClient.get<{ bookings: Booking[] }>(
        `/customer/bookings?phone=${cleanPhone}`
      );

      if (response.bookings) {
        const serviceBookings = response.bookings.filter((b: Booking) => 
          b.serviceType === serviceType
        );
        
        serviceBookings.sort((a: Booking, b: Booking) => {
          const dateA = new Date(a.scheduledDate || a.createdAt);
          const dateB = new Date(b.scheduledDate || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        setBookings(serviceBookings);
      }
    } catch (error) {
      console.error('Error loading service bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress':
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getServiceEmoji = (type: string) => {
    switch (type) {
      case 'vet': return '🏥';
      case 'grooming': return '✂️';
      case 'training': return '🎓';
      case 'boarding': return '🏠';
      case 'walker': return '🐕';
      default: return '🐾';
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

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between z-10">
            <h2 className="font-bold text-gray-800">My {serviceName} Bookings</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-0 py-0">
            {loading ? (
              <div className="flex items-center justify-center py-02">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">{getServiceEmoji(serviceType)}</div>
                <p className="text-gray-600">No {serviceName} bookings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => {
                      setSelectedBookingId(booking.id);
                      setSelectedPetId(booking.petId);
                    }}
                    className="w-full bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all text-left active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between mb-0">
                      <div className="flex items-center gap-0">
                        <div className="text-3xl">{getServiceEmoji(booking.serviceType)}</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-0">{booking.serviceName}</h3>
                          <p className="text-sm text-gray-600">{booking.vendorName}</p>
                        </div>
                      </div>
                      <span className={`px-0.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2 mb-0">
                      <div className="flex items-center gap-0 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(booking.scheduledDate)}</span>
                      </div>
                      <div className="flex items-center gap-0 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{booking.scheduledTime}</span>
                      </div>
                      <p className="text-sm text-gray-600">Pet: {booking.petName}</p>
                      {booking.price && (
                        <p className="text-sm font-semibold text-primary">₹{booking.price}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">View Details</span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          phone={phone}
          isOpen={true}
          onClose={() => {
            setSelectedBookingId(null);
            setSelectedPetId(null);
          }}
        />
      )}
    </>
  );
}

