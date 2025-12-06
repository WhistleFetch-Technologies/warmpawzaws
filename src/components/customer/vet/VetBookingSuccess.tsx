import { CheckCircle, Calendar, Clock, MapPin, Phone, Video, Download, Share2, Home as HomeIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { shareContent } from '../../../utils/shareUtils';

interface VetBookingSuccessProps {
  bookingData: {
    bookingId: string;
    otp?: string;
    petName: string;
    vendorName: string;
    serviceName: string;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    amount: number;
    address?: string;
    vendorPhone?: string;
    completionOTP?: string;
  };
  onGoHome: () => void;
  onViewBookings: () => void;
}

export function VetBookingSuccess({ bookingData, onGoHome, onViewBookings }: VetBookingSuccessProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getServiceTypeDetails = () => {
    switch (bookingData.serviceType) {
      case 'tele':
        return {
          icon: Video,
          title: 'Tele Consultation',
          color: 'from-purple-500 to-purple-600',
          nextStep: 'Join the video call at your scheduled time'
        };
      case 'clinic':
        return {
          icon: MapPin,
          title: 'Clinic Visit',
          color: 'from-blue-500 to-blue-600',
          nextStep: 'Visit the clinic at your scheduled time'
        };
      case 'home':
        return {
          icon: HomeIcon,
          title: 'Home Visit',
          color: 'from-green-500 to-green-600',
          nextStep: 'Doctor will arrive at your address'
        };
      default:
        return {
          icon: Calendar,
          title: 'Service Booking',
          color: 'from-orange-500 to-orange-600',
          nextStep: 'Service scheduled successfully'
        };
    }
  };

  const serviceDetails = getServiceTypeDetails();
  const ServiceIcon = serviceDetails.icon;

  const handleShare = async () => {
    const shareData = {
      title: 'Warmpawz Booking Confirmation',
      text: `Booking confirmed for ${bookingData.petName} with ${bookingData.vendorName} on ${new Date(bookingData.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at ${formatTime(bookingData.scheduledTime)}`,
    };

    await shareContent(shareData);
  };

  const copyBookingDetails = () => {
    const text = `🐾 Warmpawz Booking Confirmation\n\nBooking ID: ${bookingData.bookingId}\nPet: ${bookingData.petName}\nDoctor: ${bookingData.vendorName}\nDate: ${new Date(bookingData.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}\nTime: ${formatTime(bookingData.scheduledTime)}${bookingData.completionOTP ? `\nOTP: ${bookingData.completionOTP}` : ''}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          alert('✅ Booking details copied to clipboard!');
        })
        .catch(() => {
          // Final fallback - just show in alert
          alert(text);
        });
    } else {
      // Final fallback - just show in alert
      alert(text);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 max-w-md mx-auto">
      {/* Success Animation Header */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="relative w-32 h-32 mx-auto mb-6">
          {/* Animated Success Circle */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
            <CheckCircle className="w-20 h-20 text-green-500" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Booking Confirmed! 🎉
        </h1>
        <p className="text-gray-600">
          Your appointment has been successfully scheduled
        </p>
      </div>

      <div className="px-6 space-y-4 pb-24">
        {/* Booking ID Card */}
        <Card className="p-4 bg-white border-2 border-green-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Booking ID</p>
            <p className="text-2xl font-bold text-gray-900 tracking-wide">
              {bookingData.bookingId.slice(0, 12).toUpperCase()}
            </p>
          </div>
        </Card>

        {/* OTP Card (if applicable - not for tele) */}
        {bookingData.otp && bookingData.serviceType !== 'tele' && (
          <Card className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300">
            <div className="text-center">
              <p className="text-sm font-semibold text-orange-700 mb-2">🔐 Service Completion OTP</p>
              <p className="text-4xl font-bold text-orange-600 tracking-widest mb-2">
                {bookingData.otp}
              </p>
              <p className="text-xs text-orange-600">
                Share this OTP with the vet to complete the service
              </p>
            </div>
          </Card>
        )}

        {/* Service Details Card */}
        <Card className="p-5 bg-white">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${serviceDetails.color} flex items-center justify-center flex-shrink-0`}>
              <ServiceIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{serviceDetails.title}</h3>
              <p className="text-sm text-gray-600">{bookingData.serviceName}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            {/* Pet Details */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🐾</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pet</p>
                <p className="font-semibold text-gray-900">{bookingData.petName}</p>
              </div>
            </div>

            {/* Doctor Details */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">👨‍⚕️</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Doctor</p>
                <p className="font-semibold text-gray-900">{bookingData.vendorName}</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="font-semibold text-gray-900">
                  {new Date(bookingData.scheduledDate).toLocaleDateString('en-IN', { 
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-sm text-gray-600">{formatTime(bookingData.scheduledTime)}</p>
              </div>
            </div>

            {/* Address (for home visits) */}
            {bookingData.address && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="text-sm text-gray-900">{bookingData.address}</p>
                </div>
              </div>
            )}

            {/* Amount Paid */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount Paid</p>
                <p className="font-bold text-green-600 text-lg">₹{bookingData.amount}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Next Steps Card */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span>📋</span>
            What's Next?
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>{serviceDetails.nextStep}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>You'll receive a reminder 1 hour before your appointment</span>
            </li>
            {bookingData.otp && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <span>Share your OTP with the vet to complete the service</span>
              </li>
            )}
          </ul>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleShare}
            variant="outline"
            className="h-12 border-2 border-gray-300"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button
            onClick={() => {/* Download receipt */}}
            variant="outline"
            className="h-12 border-2 border-gray-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Receipt
          </Button>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 space-y-2 shadow-lg">
        <Button
          onClick={onGoHome}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] hover:from-[#FF7029] hover:to-[#FF8C42] h-12 text-base font-semibold"
        >
          Go to Home
        </Button>
        <p className="text-xs text-center text-gray-600 mt-2">
          💡 Click your profile icon to view all bookings
        </p>
      </div>
    </div>
  );
}