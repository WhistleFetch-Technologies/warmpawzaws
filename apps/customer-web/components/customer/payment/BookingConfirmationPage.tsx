'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Calendar, Clock, MapPin, User, Building2, Home, Video,
  Copy, Share2, Download, FileText, QrCode, Shield, Gift, Package, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PaymentSourcesDisplay } from './PaymentSourcesDisplay';
import type { PaymentSource } from '@/lib/payment-display-utils';
import { normalizePaymentSources } from '@/lib/payment-display-utils';

interface BookingConfirmationPageProps {
  bookingId: string;
  orderId?: string;
  type: 'booking' | 'order';
  otpCode?: string; // 4-digit OTP for eligible bookings
  
  // Booking/Order details
  serviceName?: string;
  productName?: string;
  vendorName: string;
  bookingDate?: string;
  bookingTime?: string;
  /** Multi-day boarding / sitting: end of stay */
  checkOutDate?: string;
  checkOutTime?: string;
  petName?: string;
  address?: {
    label?: string;
    addressLine1?: string;
    city?: string;
    pincode?: string;
  };
  serviceStyle?: 'at_home' | 'at_center' | 'tele' | 'ecom';
  
  // Payment details
  totalAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  paymentSources?: PaymentSource[];
  
  // Navigation
  onViewDetails: () => void;
  onBackToHome: () => void;
  /** Top bar back (e.g. return to previous step / provider profile) */
  onBack?: () => void;
  onShare?: () => void;
  // Phase 3: Upsell - Add another service
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingConfirmationPage({
  bookingId,
  orderId,
  type,
  otpCode,
  serviceName,
  productName,
  vendorName,
  bookingDate,
  bookingTime,
  checkOutDate,
  checkOutTime,
  petName,
  address,
  serviceStyle,
  totalAmount,
  paymentMethod,
  transactionId,
  paymentSources,
  onViewDetails,
  onBackToHome,
  onBack,
  onShare,
  onNavigate,
}: BookingConfirmationPageProps) {
  // Phase 3: Contextual add-on suggestions based on service type
  const addOnSuggestions = type === 'booking' && onNavigate ? (
    (serviceName || '').toLowerCase().includes('vet') || (serviceStyle === 'tele' && serviceName?.includes('Consult'))
      ? [{ label: 'Book Grooming', screen: 'grooming' }, { label: 'Book a Walk', screen: 'walker' }]
      : (serviceName || '').toLowerCase().includes('groom')
        ? [{ label: 'Book Vet', screen: 'vet' }, { label: 'Book a Walk', screen: 'walker' }]
        : (serviceName || '').toLowerCase().includes('walk')
          ? [{ label: 'Book Grooming', screen: 'grooming' }, { label: 'Book Vet', screen: 'vet' }]
          : [{ label: 'Book Grooming', screen: 'grooming' }, { label: 'Book Vet', screen: 'vet' }]
  ) : [];
  const [copied, setCopied] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);

  useEffect(() => {
    loadBookingDetails();
    // For tele consultations, start polling queue position
    if (serviceStyle === 'tele' && bookingId) {
      loadQueuePosition();
      const interval = setInterval(() => {
        loadQueuePosition();
      }, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [bookingId, serviceStyle]);

  const loadBookingDetails = async () => {
    try {
      const endpoint = type === 'booking' 
        ? `/bookings/${bookingId}`
        : `/customer/orders/${orderId || bookingId}`;
      
      const res = await apiClient.get<any>(endpoint);
      if (res.success || res.booking || res.order) {
        setBookingDetails(res.booking || res.order || res);
      }
    } catch (error) {
      console.error('Error loading booking details:', error);
    }
  };

  const loadQueuePosition = async () => {
    try {
      const res = await apiClient.get<any>(`/bookings/${bookingId}/queue-position`);
      if (res.success && res.queuePosition !== undefined) {
        setQueuePosition(res.queuePosition);
        setEstimatedWaitTime(res.estimatedWaitTime || null);
      }
    } catch (error) {
      // Queue position endpoint might not exist yet - fail silently
      console.debug('Queue position not available:', error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareBooking = () => {
    if (navigator.share) {
      navigator.share({
        title: `${type === 'booking' ? 'Booking' : 'Order'} Confirmed`,
        text: `Your ${type === 'booking' ? 'booking' : 'order'} ${bookingId} has been confirmed!`,
        url: window.location.href,
      }).catch(() => {
        // Fallback to copy
        copyToClipboard(bookingId, 'Booking ID');
      });
    } else {
      copyToClipboard(bookingId, 'Booking ID');
    }
    
    if (onShare) {
      onShare();
    }
  };

  const downloadReceipt = async () => {
    try {
      const endpoint = type === 'booking'
        ? `/bookings/${bookingId}/receipt`
        : `/customer/orders/${orderId || bookingId}/receipt`;
      
      // Use fetch directly for blob response
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to download receipt');
      }
      
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type === 'booking' ? 'booking' : 'order'}_${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Receipt downloaded!');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt');
    }
  };

  const displayName = serviceName || productName || 'Service';
  const isEligibleForOTP = type === 'booking' && serviceStyle && serviceStyle !== 'tele' && serviceStyle !== 'ecom';
  const resolvedPaymentSources =
    paymentSources && paymentSources.length > 0
      ? paymentSources
      : normalizePaymentSources(bookingDetails?.paymentSources);

  return (
    <div className="w-full max-w-customer mx-auto min-h-[100dvh] bg-gradient-to-br from-green-50 via-white to-orange-50 flex flex-col">
      {onBack && (
        <div className="shrink-0 flex items-center border-b border-gray-200/80 bg-white/90 backdrop-blur-sm px-2 py-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF8C42]" />
            Back
          </button>
        </div>
      )}
      {/* Header — same max width as app column (not full-viewport bleed) */}
      <header className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shrink-0">
        <div className="w-full px-4 py-6 text-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {type === 'booking' ? 'Booking Confirmed!' : 'Order Confirmed!'}
          </h1>
          <p className="text-white/90">
            Your {type === 'booking' ? 'appointment' : 'order'} has been scheduled successfully
          </p>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-6 space-y-4 -mt-8 pb-6">
        {/* Queue Position Card (for tele consultations) */}
        {serviceStyle === 'tele' && queuePosition !== null && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Queue Position</h2>
                  <p className="text-gray-600 text-sm">
                    Your position in the consultation queue
                  </p>
                </div>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 mb-4 border-2 border-blue-200">
                <div className="text-center">
                  <p className="text-blue-600 text-sm mb-2 font-medium">You are</p>
                  <div className="text-5xl font-bold text-blue-600 mb-2">
                    #{queuePosition}
                  </div>
                  <p className="text-gray-600 text-sm mb-3">in the queue</p>
                  {estimatedWaitTime !== null && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-gray-500 text-xs mb-1">Estimated wait time</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {estimatedWaitTime} {estimatedWaitTime === 1 ? 'minute' : 'minutes'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-blue-800 text-sm flex items-start gap-2">
                  <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    You'll receive a notification when it's your turn. 
                    Please keep your phone nearby and ensure you have a stable internet connection.
                  </span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* OTP Card (for eligible bookings) */}
        {isEligibleForOTP && otpCode && (
          <Card className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white border-0 shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold mb-1">Booking OTP</h2>
                  <p className="text-white/80 text-sm">
                    Share this 4-digit code with the service provider to start the service
                  </p>
                </div>
                <QrCode className="w-12 h-12 text-white/20" />
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-4">
                <div className="text-center">
                  <p className="text-white/60 text-sm mb-2">Your Booking OTP</p>
                  <div className="flex items-center justify-center gap-3 mb-3">
                    {otpCode.split('').map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl font-bold text-[#FF8C42] shadow-lg"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                  <p className="text-white/80 text-sm font-mono">{otpCode}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(otpCode, 'OTP')}
                  variant="outline"
                  className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy OTP
                </Button>
                <Button
                  onClick={shareBooking}
                  variant="outline"
                  className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
              
              <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                <p className="text-white/90 text-sm flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Important:</strong> This OTP must be shared with the service provider 
                    {serviceStyle === 'at_home' ? ' when they arrive at your location' : ' at the clinic'} 
                    to complete the service. Once the service is completed and OTP is verified, 
                    payment will be released to the provider.
                  </span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Booking/Order Details Card */}
        <Card className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="text-center mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-500 mb-1">
              {type === 'booking' ? 'Booking' : 'Order'} ID
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="font-mono font-bold text-lg text-gray-900">{bookingId}</p>
              <button
                onClick={() => copyToClipboard(bookingId, 'Booking ID')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {transactionId && (
              <p className="text-xs text-gray-400 mt-1">Txn: {transactionId}</p>
            )}
          </div>
          
          <div className="space-y-4">
            {/* Service/Product */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                serviceStyle === 'tele' ? 'bg-blue-100' :
                serviceStyle === 'at_home' ? 'bg-green-100' : 
                serviceStyle === 'at_center' ? 'bg-purple-100' : 'bg-orange-100'
              }`}>
                {serviceStyle === 'tele' ? <Video className="w-5 h-5 text-blue-600" /> :
                 serviceStyle === 'at_home' ? <Home className="w-5 h-5 text-green-600" /> :
                 serviceStyle === 'at_center' ? <Building2 className="w-5 h-5 text-purple-600" /> :
                 <Package className="w-5 h-5 text-orange-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">{type === 'booking' ? 'Service' : 'Product'}</p>
                <p className="font-semibold text-gray-900">{displayName}</p>
                <p className="text-sm text-gray-500">{vendorName}</p>
              </div>
            </div>
            
            {/* Schedule (for bookings) */}
            {type === 'booking' && (bookingDate || bookingTime || checkOutDate || checkOutTime) && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Schedule</p>
                  <p className="font-medium text-gray-900">
                    {bookingDate && new Date(bookingDate).toLocaleDateString('en-IN', { 
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                    {bookingTime && ` · ${bookingTime}`}
                  </p>
                  {(checkOutDate || checkOutTime) && (
                    <p className="mt-1 text-sm text-gray-700">
                      <span className="text-gray-500">Check-out: </span>
                      {checkOutDate
                        ? new Date(checkOutDate).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : null}
                      {checkOutTime ? ` · ${checkOutTime}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Pet (for bookings) */}
            {type === 'booking' && petName && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="font-medium text-gray-900">{petName}</p>
                </div>
              </div>
            )}
            
            {/* Address */}
            {address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{address.label || 'Home'}</p>
                  <p className="text-sm text-gray-500">
                    {address.addressLine1 || address.label || 'Address'}, {address.city} - {address.pincode}
                  </p>
                </div>
              </div>
            )}
            
            {/* Payment */}
            <div className="pt-3 border-t border-gray-200 space-y-3">
              {resolvedPaymentSources.length > 0 ? (
                <PaymentSourcesDisplay
                  sources={resolvedPaymentSources}
                  totalPaid={totalAmount}
                  compact
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="font-bold text-lg text-[#FF8C42]">₹{totalAmount.toFixed(2)}</p>
                    {paymentMethod && (
                      <p className="text-xs text-gray-400 mt-1">
                        Paid via {paymentMethod === 'razorpay' ? 'Razorpay' : paymentMethod}
                      </p>
                    )}
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Paid
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Next Steps Card */}
        <Card className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">What's Next?</h3>
          
          {type === 'booking' ? (
            <div className="space-y-3">
              {serviceStyle === 'tele' ? (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                  <Video className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Video Consultation</p>
                    <p className="text-sm text-gray-600">
                      You'll receive a call/video link before your scheduled time. Make sure your pet is ready!
                    </p>
                  </div>
                </div>
              ) : serviceStyle === 'at_home' ? (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                  <Home className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Home Visit</p>
                    <p className="text-sm text-gray-600">
                      The service provider will arrive at your location. Share the OTP when they arrive to start the service.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
                  <Building2 className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Clinic Visit</p>
                    <p className="text-sm text-gray-600">
                      Visit the clinic at your scheduled time. Share the OTP at the reception to start the service.
                    </p>
                  </div>
                </div>
              )}
              
              {isEligibleForOTP && otpCode && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm text-orange-800 font-medium mb-1">
                    📱 Your OTP: <span className="font-mono font-bold">{otpCode}</span>
                  </p>
                  <p className="text-xs text-orange-700">
                    Keep this OTP ready to share with the service provider
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
              <Package className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Order Processing</p>
                <p className="text-sm text-gray-600">
                  Your order is being processed. You'll receive tracking details soon.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Phase 3: Add another service upsell */}
        {addOnSuggestions.length > 0 && (
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-5 shadow-sm border border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Gift className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Add another service?</h3>
                <p className="text-sm text-gray-600">Customers often add these</p>
              </div>
            </div>
            <div className="flex gap-2">
              {addOnSuggestions.map((s) => (
                <Button
                  key={s.screen}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => onNavigate?.(s.screen)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Package Upsell (for bookings) */}
        {type === 'booking' && (
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-5 shadow-sm border border-purple-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900">Save with a Package!</h3>
                <p className="text-sm text-purple-600">Get up to 30% off with health packages</p>
              </div>
            </div>
            <Button 
              variant="outline"
              className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Package className="w-4 h-4 mr-2" />
              View Packages
            </Button>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onViewDetails}
            className="w-full bg-[#FF8C42] hover:bg-[#E67A35] text-white py-3"
          >
            <FileText className="w-5 h-5 mr-2" />
            View {type === 'booking' ? 'Booking' : 'Order'} Details
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={downloadReceipt}
              variant="outline"
              className="border-gray-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Receipt
            </Button>
            <Button
              onClick={shareBooking}
              variant="outline"
              className="border-gray-200"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
          
          <Button
            onClick={onBackToHome}
            variant="outline"
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </main>
    </div>
  );
}

export default BookingConfirmationPage;
