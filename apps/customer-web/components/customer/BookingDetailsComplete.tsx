'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Phone, CheckCircle, XCircle, AlertCircle, FileText, MessageSquare, Activity, Download, Navigation, Video } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { BookingActions } from './BookingActions';
import { GPSTrackingView } from './booking/GPSTrackingView';
import { VideoCallView } from './booking/VideoCallView';
import { PackageSessionView } from './booking/PackageSessionView';

interface BookingDetailsCompleteProps {
  bookingId: string;
  phone: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export function BookingDetailsComplete({ bookingId, phone, onBack, onSuccess }: BookingDetailsCompleteProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showGPSTracking, setShowGPSTracking] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showPackageSession, setShowPackageSession] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      // Use enhanced endpoint to get all related data
      const response = await apiClient.get<{
        booking: any;
        prescriptions: any[];
        medicalRecords: any[];
        chat: { messages: any[]; messageCount: number; hasUnreadMessages: boolean };
        summary: {
          hasPrescription: boolean;
          hasMedicalRecords: boolean;
          hasChatMessages: boolean;
        };
      }>(`/bookings/${bookingId}/enhanced?actorId=${phone}&actorRole=customer`);
      
      if (response.booking) {
        setBooking({
          ...response.booking,
          prescriptions: response.prescriptions || [],
          medicalRecords: response.medicalRecords || [],
          chat: response.chat || { messages: [], messageCount: 0, hasUnreadMessages: false },
          summary: response.summary || {},
        });
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      // Fallback to basic endpoint if enhanced fails
      try {
        const fallback = await apiClient.get<{ booking: any }>(`/bookings/${bookingId}`);
        if (fallback.booking) {
          setBooking(fallback.booking);
        }
      } catch (fallbackError) {
        console.error('Error loading booking (fallback):', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    loadBooking();
    onSuccess?.();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'cancelled': return <XCircle className="w-8 h-8 text-red-600" />;
      case 'pending': return <AlertCircle className="w-8 h-8 text-yellow-600" />;
      default: return <AlertCircle className="w-8 h-8 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center p-0">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <button
            onClick={onBack}
            className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-0 pt-12 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Booking Details</h1>
            <p className="text-white/90 text-sm">Booking #{booking.id?.slice(-8)}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center gap-0">
            {getStatusIcon(booking.status)}
            <div>
              <p className="text-white font-semibold">
                {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
              </p>
              <p className="text-white/80 text-sm">
                {booking.status === 'confirmed' ? 'Your booking is confirmed' :
                 booking.status === 'pending' ? 'Waiting for confirmation' :
                 booking.status === 'cancelled' ? 'This booking has been cancelled' :
                 'Booking status'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Service Info Card */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Service Information</h3>
          <div className="space-y-3">
            {booking.serviceName && (
              <div>
                <p className="text-sm text-gray-600">Service</p>
                <p className="font-semibold text-gray-900">{booking.serviceName}</p>
              </div>
            )}
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
            {booking.price && (
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-primary">₹{booking.price}</p>
              </div>
            )}
          </div>
        </div>

        {/* Vendor Info Card */}
        {booking.vendorName && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Service Provider</h3>
            <div className="space-y-3">
              <p className="font-semibold text-gray-900">{booking.vendorName}</p>
              {booking.vendorPhone && (
                <a
                  href={`tel:${booking.vendorPhone}`}
                  className="flex items-center gap-0 text-primary hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  <span>{booking.vendorPhone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pet Info Card */}
        {booking.petName && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Pet</h3>
            <p className="font-semibold text-gray-900">{booking.petName}</p>
          </div>
        )}

        {/* Address Card */}
        {booking.address && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Service Address</h3>
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
        )}

        {/* Prescriptions Card */}
        {booking.summary?.hasPrescription && booking.prescriptions && booking.prescriptions.length > 0 && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-0">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900">Prescriptions</h3>
              </div>
              <span className="text-sm text-gray-500">{booking.prescriptions.length} prescription(s)</span>
            </div>
            <div className="space-y-3">
              {booking.prescriptions.slice(0, 2).map((prescription: any) => (
                <div key={prescription.id} className="border border-gray-200 rounded-lg p-0">
                  {prescription.diagnosis && (
                    <p className="font-semibold text-gray-900 mb-0">{prescription.diagnosis}</p>
                  )}
                  {prescription.medications && Array.isArray(prescription.medications) && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium mb-0">Medications:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {prescription.medications.map((med: any, idx: number) => (
                          <li key={idx}>
                            {med.name} - {med.dosage} {med.frequency && `(${med.frequency})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prescription.follow_up_date && (
                    <p className="text-xs text-gray-500 mt-0">
                      Follow-up: {new Date(prescription.follow_up_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
              {booking.prescriptions.length > 2 && (
                <button
                  onClick={() => {
                    // Navigate to full prescriptions view
                    window.location.href = `/medical-records?bookingId=${bookingId}`;
                  }}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View all {booking.prescriptions.length} prescriptions →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Medical Records Card */}
        {booking.summary?.hasMedicalRecords && booking.medicalRecords && booking.medicalRecords.length > 0 && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-0">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900">Medical Records</h3>
              </div>
              <span className="text-sm text-gray-500">{booking.medicalRecords.length} record(s)</span>
            </div>
            <div className="space-y-2">
              {booking.medicalRecords.slice(0, 2).map((record: any) => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-0">
                  <p className="font-semibold text-gray-900">{record.title || record.record_type}</p>
                  {record.description && (
                    <p className="text-sm text-gray-600 mt-0 line-clamp-0">{record.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0">
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {booking.medicalRecords.length > 2 && (
                <button
                  onClick={() => {
                    window.location.href = `/medical-records?bookingId=${bookingId}`;
                  }}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View all {booking.medicalRecords.length} records →
                </button>
              )}
            </div>
          </div>
        )}

        {/* GPS Tracking (for home services) */}
        {booking.service_type === 'at_home' || booking.service_type === 'home' && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-0">
                <Navigation className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900">Live Tracking</h3>
              </div>
              <button
                onClick={() => setShowGPSTracking(!showGPSTracking)}
                className="text-primary text-sm font-medium hover:underline"
              >
                {showGPSTracking ? 'Hide' : 'View'}
              </button>
            </div>
            {showGPSTracking && (
              <GPSTrackingView bookingId={bookingId} onClose={() => setShowGPSTracking(false)} />
            )}
          </div>
        )}

        {/* Video Call (for tele services) */}
        {(booking.service_type === 'online' || booking.service_type === 'tele') && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-0">
                <Video className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900">Video Consultation</h3>
              </div>
              <button
                onClick={() => setShowVideoCall(!showVideoCall)}
                className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
              >
                {showVideoCall ? 'Hide' : 'Start Call'}
              </button>
            </div>
            {showVideoCall && (
              <VideoCallView
                bookingId={bookingId}
                participantType="customer"
                onEndCall={() => setShowVideoCall(false)}
              />
            )}
          </div>
        )}

        {/* Package Sessions (for package bookings) */}
        {booking.service_type === 'package' && (
          <PackageSessionView bookingId={bookingId} packageId={booking.package_id} />
        )}

        {/* Chat Card */}
        {booking.chatEnabled && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-0">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900">Chat</h3>
              </div>
              {booking.chat?.hasUnreadMessages && (
                <span className="bg-red-500 text-white text-xs px-0 py-0 rounded-full">
                  {booking.chat?.messageCount || 0} new
                </span>
              )}
            </div>
            {booking.chat?.messages && booking.chat.messages.length > 0 ? (
              <div className="space-y-2">
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {booking.chat.messages.slice(-3).map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`p-0 rounded-lg ${
                        msg.sender_type === 'customer' ? 'bg-primary/10 ml-auto' : 'bg-gray-100'
                      }`}
                    >
                      <p className="text-sm text-gray-900">{msg.message}</p>
                      <p className="text-xs text-gray-500 mt-0">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    window.location.href = `/chat?bookingId=${bookingId}`;
                  }}
                  className="w-full mt-0 px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Open Chat
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 text-sm mb-0">No messages yet</p>
                <button
                  onClick={() => {
                    window.location.href = `/chat?bookingId=${bookingId}`;
                  }}
                  className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Start Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notes Card */}
        {booking.notes && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Notes</h3>
            <p className="text-gray-900">{booking.notes}</p>
          </div>
        )}

        {/* Actions */}
        <BookingActions booking={booking} phone={phone} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}

