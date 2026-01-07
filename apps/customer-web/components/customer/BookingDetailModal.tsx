'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Phone, User, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { BookingActions } from './BookingActions';

interface BookingDetailModalProps {
  bookingId: string;
  phone: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BookingDetailModal({ bookingId, phone, isOpen, onClose, onSuccess }: BookingDetailModalProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && bookingId) {
      loadBooking();
    }
  }, [isOpen, bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ booking: any }>(`/bookings/${bookingId}`);
      if (response.booking) {
        setBooking(response.booking);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    loadBooking();
    onSuccess?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-primary-dark px-0 py-0 flex items-center justify-between z-10">
          <h2 className="text-white font-bold text-lg">Booking Details</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="px-0 py-0">
          {loading ? (
            <div className="flex items-center justify-center py-02">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !booking ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Booking not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`px-0 py-1 rounded-full text-sm font-semibold ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                  </span>
                </div>
              </div>

              {/* Service Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-0">Service Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-0">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Time</p>
                      <p className="font-semibold text-gray-900">{booking.scheduledTime}</p>
                    </div>
                  </div>
                  {booking.serviceName && (
                    <div>
                      <p className="text-sm text-gray-600">Service</p>
                      <p className="font-semibold text-gray-900">{booking.serviceName}</p>
                    </div>
                  )}
                  {booking.price && (
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="font-semibold text-gray-900">₹{booking.price}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor Info */}
              {booking.vendorName && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-0">Service Provider</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="font-semibold text-gray-900">{booking.vendorName}</p>
                    {booking.vendorPhone && (
                      <a
                        href={`tel:${booking.vendorPhone}`}
                        className="flex items-center gap-0 text-primary mt-0 hover:underline"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{booking.vendorPhone}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Pet Info */}
              {booking.petName && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-0">Pet</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="font-semibold text-gray-900">{booking.petName}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              {booking.address && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-0">Service Address</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start gap-0">
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0" />
                      <div>
                        {typeof booking.address === 'string' ? (
                          <p className="text-gray-900">{booking.address}</p>
                        ) : (
                          <>
                            <p className="text-gray-900">{booking.address.street}</p>
                            <p className="text-gray-900">
                              {booking.address.city}, {booking.address.state} {booking.address.pincode}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {booking.notes && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-0">Notes</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-900">{booking.notes}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <BookingActions booking={booking} phone={phone} onSuccess={handleSuccess} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

