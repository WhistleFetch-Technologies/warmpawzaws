'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Phone, FileText, MessageCircle, History, AlertCircle, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorBookingDetailModalProps {
  bookingId: string;
  vendorPhone: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function VendorBookingDetailModal({
  bookingId,
  vendorPhone,
  onClose,
  onRefresh
}: VendorBookingDetailModalProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/bookings/${bookingId}`);
      setBooking(response.booking);
      checkPrescription(bookingId);
    } catch (error) {
      console.error('Error loading booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPrescription = async (bookingId: string) => {
    try {
      await apiClient.get(`/prescriptions/booking/${bookingId}`);
      setHasPrescription(true);
    } catch (error) {
      setHasPrescription(false);
    }
  };

  const handleCopyOtp = () => {
    if (booking?.otp_code) {
      navigator.clipboard.writeText(booking.otp_code);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Booking Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-00">
            <div className="w-12 h-12 border-4 border-[primary] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : !booking ? (
          <div className="text-center py-00">
            <p className="text-gray-600">Booking not found</p>
          </div>
        ) : (
          <div className="p-0 space-y-6 pb-24">
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 rounded-full font-semibold border ${getStatusColor(booking.status)}`}>
                {booking.status === 'in_progress' ? 'In Progress' : 
                 booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
              <span className="text-sm text-gray-600">
                Booking #{booking.id?.slice(0, 8)}
              </span>
            </div>

            {booking.otp_code && booking.status !== 'completed' && booking.status !== 'cancelled' && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-0">
                <div className="flex items-center gap-0 mb-0">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-xl">🔐</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-900">Customer OTP</h3>
                    <p className="text-xs text-orange-700">Get this from customer to complete service</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 mb-0">
                  <div className="flex items-center justify-center gap-0">
                    <span className="text-4xl font-bold text-orange-600 tracking-[0.5em] font-mono">
                      {booking.otp_code}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyOtp}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-0 rounded-xl flex items-center justify-center gap-0 transition-colors"
                >
                  {copiedOtp ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy OTP
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-0">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold text-gray-900">{booking.customer?.name || booking.customer_name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-0">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${booking.customer?.phone || booking.customer_phone}`} className="font-semibold text-[primary]">
                    {booking.customer?.phone || booking.customer_phone || 'N/A'}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-0">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(booking.booking_date).toLocaleDateString()} at {booking.booking_time}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Service</p>
                  <p className="font-semibold text-gray-900">{booking.service?.name || booking.service_name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

