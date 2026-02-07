import { useState } from 'react';
import { ArrowLeft, Check, CreditCard, Wallet, Building, ChevronRight, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { WalkerActiveSession } from './WalkerActiveSession';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
}

export function WalkerBookingConfirm({
  bookingDetails,
  phone,
  onBack,
  onBackToHome
}: {
  bookingDetails: BookingDetails;
  phone: string;
  onBack: () => void;
  onBackToHome: () => void;
}) {
  const [step, setStep] = useState<'payment' | 'success' | 'tracking'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'wallet'>('upi');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const basePrice = bookingDetails.duration === '30' ? 199 : 349;
  const frequency = bookingDetails.frequency;
  const multiplier = frequency === 'weekly' ? 7 : frequency === 'monthly' ? 30 : 1;
  const sessionsPerDay = bookingDetails.sessionsPerDay || 1;
  const totalSessions = multiplier * sessionsPerDay;
  
  const subtotal = basePrice * totalSessions;
  const discount = frequency === 'weekly' ? subtotal * 0.15 : frequency === 'monthly' ? subtotal * 0.30 : 0;
  const gst = (subtotal - discount) * 0.18;
  const total = subtotal - discount + gst;

  const handlePayment = async () => {
    setProcessing(true);
    
    try {
      // Save booking to backend
      const response = await fetch(
        `${getApiBaseUrl()}/walker/booking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            phone,
            bookingDetails,
            paymentMethod,
            amount: total,
            startDate
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBookingId(result.bookingId || `WB${Date.now()}`);
      } else {
        // Demo mode
        setBookingId(`WB${Date.now()}`);
      }

      // Simulate payment processing
      setTimeout(() => {
        setProcessing(false);
        setStep('success');
      }, 2000);
    } catch (error) {
      console.error('Payment error:', error);
      setBookingId(`WB${Date.now()}`);
      setTimeout(() => {
        setProcessing(false);
        setStep('success');
      }, 2000);
    }
  };

  const handleTrackNow = () => {
    setStep('tracking');
  };

  if (step === 'tracking') {
    return (
      <WalkerActiveSession
        bookingId={bookingId}
        bookingDetails={bookingDetails}
        phone={phone}
        onBack={() => setStep('success')}
        onBackToHome={onBackToHome}
      />
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Success Animation */}
          <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce">
            <Check className="w-16 h-16 text-white stroke-[3]" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Booking Confirmed! 🎉</h1>
            <p className="text-gray-600 mb-2">Your walker has been successfully booked</p>
            <p className="text-sm text-gray-500">Booking ID: {bookingId}</p>
          </div>

          {/* Booking Details Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="text-gray-600">Pet Name</span>
                <span className="font-semibold text-gray-800">{bookingDetails.petName}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="text-gray-600">Frequency</span>
                <span className="font-semibold text-gray-800 capitalize">{bookingDetails.frequency}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="text-gray-600">Total Sessions</span>
                <span className="font-semibold text-gray-800">{totalSessions} walks</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="text-gray-600">Start Date</span>
                <span className="font-semibold text-gray-800">{new Date(startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-600 font-semibold">Amount Paid</span>
                <span className="text-2xl font-bold text-green-600">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {bookingDetails.frequency === 'single' && (
              <Button
                onClick={handleTrackNow}
                className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold"
              >
                Track Walker Now
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}
            
            <Button
              onClick={onBackToHome}
              className="w-full bg-white text-gray-700 py-6 rounded-xl font-semibold border-2 border-gray-200"
            >
              Back to Home
            </Button>
          </div>

          {/* Info Message */}
          {bookingDetails.frequency !== 'single' && (
            <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm text-blue-800 text-center">
                📱 You'll receive OTP before each session to verify the walker's arrival
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Payment</h1>
            <p className="text-white/90 text-sm">Complete your booking</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Start Date Selection */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-black font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            Start Date
          </h2>
          <input
            type="date"
            value={startDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-black font-semibold mb-4">Price Breakdown</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Base Price × {totalSessions} sessions</span>
              <span className="font-medium text-gray-800">₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Discount ({frequency === 'weekly' ? '15%' : '30%'})</span>
                <span className="font-medium">- ₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">GST (18%)</span>
              <span className="font-medium text-gray-800">₹{gst.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-800">Total Amount</span>
              <span className="text-2xl font-bold text-[#FF8C42]">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-black font-semibold mb-4">Payment Method</h2>
          <div className="space-y-3">
            {[
              { value: 'upi', label: 'UPI', icon: <Wallet className="w-5 h-5" />, desc: 'Pay via UPI apps' },
              { value: 'card', label: 'Credit/Debit Card', icon: <CreditCard className="w-5 h-5" />, desc: 'Visa, Mastercard, RuPay' },
              { value: 'wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" />, desc: 'Paytm, PhonePe, GPay' }
            ].map((method) => (
              <button
                key={method.value}
                onClick={() => setPaymentMethod(method.value as any)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === method.value
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  paymentMethod === method.value ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {method.icon}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-800">{method.label}</h3>
                  <p className="text-sm text-gray-600">{method.desc}</p>
                </div>
                {paymentMethod === method.value && (
                  <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-sm text-blue-800">
            ✓ 100% Money-back guarantee if walker doesn't show up
            <br />
            ✓ GPS tracking available for all walks
            <br />
            ✓ Photo & video updates after each session
            <br />
            ✓ Insured walkers with background verification
          </p>
        </div>

        {/* Pay Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto">
          <Button
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold disabled:opacity-50"
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing Payment...
              </>
            ) : (
              <>
                Pay ₹{total.toFixed(2)}
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}