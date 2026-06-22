'use client';

import React from 'react';
import { 
  CheckCircle2, Calendar, Clock, MapPin, User, 
  Phone, Home, Share2, Download, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download-file';

interface BookingConfirmationProps {
  bookingId: string;
  serviceName: string;
  vendorName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  bookingDate: string;
  bookingTime: string;
  petName?: string;
  address?: {
    label?: string;
    addressLine1?: string;
    city?: string;
    pincode?: string;
  };
  totalPaid: number;
  otpCode?: string;
  onViewBookings: () => void;
  onGoHome: () => void;
}

export function BookingConfirmation({
  bookingId,
  serviceName,
  vendorName,
  serviceStyle,
  bookingDate,
  bookingTime,
  petName,
  address,
  totalPaid,
  otpCode,
  onViewBookings,
  onGoHome,
}: BookingConfirmationProps) {
  const formattedDate = new Date(bookingDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleShare = async () => {
    const shareText = `🐾 Warmpawz Booking Confirmed!\n\n📋 Service: ${serviceName}\n📅 Date: ${formattedDate}\n⏰ Time: ${bookingTime}\n🏥 Provider: ${vendorName}\n\nBooking ID: ${bookingId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Warmpawz Booking Confirmed',
          text: shareText,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Booking details copied to clipboard!');
    }
  };

  const handleDownload = async () => {
    const receipt = `
═══════════════════════════════════════
         WARMPAWZ BOOKING RECEIPT
═══════════════════════════════════════

Booking ID: ${bookingId}

SERVICE DETAILS
───────────────────────────────────────
Service: ${serviceName}
Provider: ${vendorName}
Type: ${serviceStyle === 'at_home' ? 'Home Visit' : serviceStyle === 'at_center' ? 'At Clinic' : 'Tele Consultation'}

SCHEDULE
───────────────────────────────────────
Date: ${formattedDate}
Time: ${bookingTime}
${petName ? `Pet: ${petName}` : ''}
${address ? `Address: ${address.addressLine1}, ${address.city} - ${address.pincode}` : ''}

PAYMENT
───────────────────────────────────────
Amount Paid: ₹${totalPaid.toFixed(2)}
${otpCode ? `\nSERVICE OTP: ${otpCode}` : ''}

═══════════════════════════════════════
Thank you for choosing Warmpawz! 🐾
═══════════════════════════════════════
    `;
    
    const blob = new Blob([receipt], { type: 'text/plain' });
    await downloadBlob({
      blob,
      fileName: `warmpawz-booking-${bookingId}.txt`,
      title: 'Booking receipt',
      previewHtmlInBrowser: false,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 pb-8">
      {/* Success Animation Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-12 text-center relative overflow-hidden">
        {/* Confetti decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {['🎉', '✨', '🐾', '💚'][i % 4]}
            </div>
          ))}
        </div>
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed! 🎉</h1>
          <p className="text-green-100">Your appointment has been successfully scheduled</p>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* OTP Card - Only for home and center services */}
        {otpCode && serviceStyle !== 'tele' && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Service Verification OTP</h3>
                <p className="text-amber-100 text-sm">
                  Share this with your service provider
                </p>
              </div>
            </div>
            
            <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-center">
              <div className="flex justify-center gap-2">
                {otpCode.split('').map((digit, i) => (
                  <div
                    key={i}
                    className="w-14 h-16 bg-white text-amber-600 rounded-lg flex items-center justify-center text-3xl font-bold shadow-md"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-amber-100 text-xs mt-3">
                {serviceStyle === 'at_home' 
                  ? '🏠 Provider will ask for this OTP when they arrive at your location'
                  : '🏥 Share this OTP at the clinic to start your appointment'}
              </p>
            </div>
          </div>
        )}

        {/* Booking Details Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Booking Details</h2>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              Confirmed
            </span>
          </div>

          <div className="space-y-4">
            {/* Service */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                serviceStyle === 'tele' ? 'bg-blue-100' :
                serviceStyle === 'at_home' ? 'bg-green-100' : 'bg-purple-100'
              }`}>
                {serviceStyle === 'tele' ? '📱' : serviceStyle === 'at_home' ? '🏠' : '🏥'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{serviceName}</h3>
                <p className="text-sm text-gray-500">{vendorName}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                  serviceStyle === 'tele' ? 'bg-blue-100 text-blue-700' :
                  serviceStyle === 'at_home' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {serviceStyle === 'tele' ? 'Tele Consultation' :
                   serviceStyle === 'at_home' ? 'Home Visit' : 'At Clinic'}
                </span>
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
              <Calendar className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-gray-900">{formattedDate}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {bookingTime}
                </p>
              </div>
            </div>

            {/* Pet */}
            {petName && (
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="font-medium text-gray-900">{petName}</p>
                </div>
              </div>
            )}

            {/* Address (for home services) */}
            {serviceStyle === 'at_home' && address && (
              <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl">
                <Home className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{address.label || 'Delivery Address'}</p>
                  <p className="font-medium text-gray-900">
                    {address.addressLine1}, {address.city} - {address.pincode}
                  </p>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Amount Paid</span>
                <span className="text-lg font-bold text-green-600">₹{totalPaid.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking ID */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Booking ID</p>
              <p className="font-mono font-bold text-gray-900">{bookingId}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                title="Share"
              >
                <Share2 className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                title="Download Receipt"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Tele Consultation Info */}
        {serviceStyle === 'tele' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                📱
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Video Consultation</h3>
                <p className="text-sm text-blue-700 mt-1">
                  You'll receive a video call link 10 minutes before your appointment. 
                  Make sure you have a stable internet connection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-3">What's Next?</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">1</div>
              <p className="text-sm text-gray-600 flex-1">
                You'll receive a confirmation SMS and email with booking details
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">2</div>
              <p className="text-sm text-gray-600 flex-1">
                {serviceStyle === 'tele' 
                  ? 'Join the video call at the scheduled time'
                  : serviceStyle === 'at_home'
                  ? 'Our service provider will arrive at your location'
                  : 'Visit the clinic at the scheduled time'}
              </p>
            </li>
            {otpCode && serviceStyle !== 'tele' && (
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">3</div>
                <p className="text-sm text-gray-600 flex-1">
                  Share the OTP ({otpCode}) with your service provider to start the service
                </p>
              </li>
            )}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onViewBookings}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-2"
          >
            View My Bookings
          </Button>
          <Button
            onClick={onGoHome}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            Go Home
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
}

export default BookingConfirmation;
