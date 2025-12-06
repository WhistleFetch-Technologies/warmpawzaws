import { useState } from 'react';
import { CheckCircle, Calendar, Clock, MapPin, User, Share2, Download, Home, Phone, Copy, Scissors } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { shareContent } from '../../../utils/shareUtils';

interface BookingConfirmationProps {
  bookingData: {
    bookingId: string;
    serviceName: string;
    serviceType: 'center' | 'home';
    vendorName: string;
    vendorAddress?: string;
    petName: string;
    petId?: string; // ✅ ADD: Pet ID for navigation
    date: string;
    time: string;
    amount: number;
    paymentMethod: string;
    otp?: string;
  };
  onViewBooking?: () => void; // ✅ OPTIONAL: Legacy support
  onViewAppointment?: (appointmentId: string) => void; // ✅ NEW: Navigate to appointment details
  onBackToDashboard: () => void;
}

export function BookingConfirmation({ bookingData, onViewBooking, onViewAppointment, onBackToDashboard }: BookingConfirmationProps) {
  const [otpCopied, setOtpCopied] = useState(false);

  const handleCopyOTP = () => {
    if (bookingData.otp) {
      navigator.clipboard.writeText(bookingData.otp);
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2000);
    }
  };

  const handleAddToCalendar = () => {
    // Create calendar event content (ICS format)
    const startTime = bookingData.date + 'T' + bookingData.time.replace(':', '') + '00';
    // Assume 1 hour duration if not specified
    const endDateObj = new Date(`${bookingData.date}T${bookingData.time}`);
    endDateObj.setHours(endDateObj.getHours() + 1);
    
    const endYear = endDateObj.getFullYear();
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDateObj.getDate()).padStart(2, '0');
    const endHour = String(endDateObj.getHours()).padStart(2, '0');
    const endMin = String(endDateObj.getMinutes()).padStart(2, '0');
    
    const endTime = `${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `SUMMARY:${bookingData.serviceName} Appointment`,
      `DESCRIPTION:${bookingData.serviceName} for ${bookingData.petName} with ${bookingData.vendorName}. Booking ID: ${bookingData.bookingId}`,
      `LOCATION:${bookingData.vendorAddress || 'Home Service'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'appointment.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Success Header */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 text-white px-6 pt-12 pb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-white/90">Your grooming session is scheduled</p>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Booking ID */}
        <Card className="p-4 bg-gradient-to-br from-orange-50 to-white border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Booking ID</p>
              <p className="font-bold text-lg text-gray-900">{bookingData.bookingId}</p>
            </div>
            <Badge className="bg-green-100 text-green-700 border-none">Confirmed</Badge>
          </div>
        </Card>

        {/* OTP Display - IMPORTANT */}
        {bookingData.otp && (
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">OTP</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Service Completion OTP</h3>
                <p className="text-sm text-gray-600">Share this with groomer after service</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border-2 border-purple-200 p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-bold text-purple-600 tracking-wider">
                    {bookingData.otp}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyOTP}
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  {otpCopied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="bg-purple-100 rounded-lg p-3 text-sm text-purple-800">
              <p className="font-semibold mb-1">⚠️ Important:</p>
              <p>Only share this OTP with the groomer after service completion. This confirms the service and triggers payment.</p>
            </div>
          </Card>
        )}

        {/* Booking Details */}
        <Card className="p-4 border border-gray-200">
          <h3 className="font-semibold mb-4">Booking Details</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Scissors className="w-5 h-5 text-[#FF8C42] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Service</p>
                <p className="font-semibold">{bookingData.serviceName}</p>
                <Badge 
                  variant="secondary" 
                  className="text-xs mt-1"
                >
                  {bookingData.serviceType === 'home' ? 'At Home' : 'At Center'}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#FF8C42] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Vendor</p>
                <p className="font-semibold">{bookingData.vendorName}</p>
                {bookingData.vendorAddress && (
                  <p className="text-sm text-gray-500 mt-0.5">{bookingData.vendorAddress}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[#FF8C42] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Pet</p>
                <p className="font-semibold">{bookingData.petName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#FF8C42] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold">
                  {new Date(bookingData.date).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#FF8C42] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-semibold">{bookingData.time}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Summary */}
        <Card className="p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">Payment Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Amount Paid</span>
              <span className="font-bold text-green-600">₹{bookingData.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payment Method</span>
              <span className="capitalize">{bookingData.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status</span>
              <Badge className="bg-green-100 text-green-700 border-none text-xs">Paid</Badge>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
            onClick={() => {
              // ✅ NEW: Use appointment navigation if available, fallback to legacy
              if (onViewAppointment) {
                onViewAppointment(bookingData.bookingId);
              } else if (onViewBooking) {
                onViewBooking();
              }
            }}
          >
            View Appointment Details
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={handleAddToCalendar}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Add to Calendar
            </Button>

            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={async () => {
                await shareContent({
                  title: `${bookingData.serviceName} Booking`,
                  text: `Booking ID: ${bookingData.bookingId}\nDate: ${bookingData.date}\nTime: ${bookingData.time}\nVendor: ${bookingData.vendorName}`,
                });
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            onClick={onBackToDashboard}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Help Section */}
        <Card className="p-4 bg-blue-50 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">Need Help?</h4>
          <p className="text-sm text-blue-800 mb-3">
            If you need to reschedule or have questions, contact us at:
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-900">📞 Phone: 1800-XXX-XXXX</p>
            <p className="text-blue-900">📧 Email: support@warmpawz.com</p>
          </div>
        </Card>
      </div>
    </div>
  );
}