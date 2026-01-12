import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CreditCard, Wallet, Building, Smartphone, ShieldCheck, Clock, Calendar } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';

interface VetPaymentScreenProps {
  bookingDetails: {
    petName: string;
    petType: string;
    vendorName: string;
    serviceName: string;
    servicePrice: number;
    serviceDuration: number;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    address?: string;
  };
  onBack: () => void;
  onPaymentComplete: (paymentMethod: string, transactionId: string) => void;
}

export function VetPaymentScreen({ bookingDetails, onBack, onPaymentComplete }: VetPaymentScreenProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  // Calculate pricing
  const serviceCharge = bookingDetails.servicePrice;
  const platformFee = Math.round(serviceCharge * 0.05); // 5% platform fee
  const gst = Math.round((serviceCharge + platformFee) * 0.18); // 18% GST
  const totalAmount = serviceCharge + platformFee + gst;

  const paymentMethods = [
    {
      id: 'upi',
      name: 'UPI',
      icon: Smartphone,
      description: 'Google Pay, PhonePe, Paytm',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCard,
      description: 'Visa, Mastercard, Rupay',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'wallet',
      name: 'Wallet',
      icon: Wallet,
      description: 'Paytm, Amazon Pay, Mobikwik',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      icon: Building,
      description: 'All major banks',
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const handlePayment = async () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      onPaymentComplete(selectedPaymentMethod, transactionId);
    }, 2000);
  };

  const getServiceTypeLabel = () => {
    switch (bookingDetails.serviceType) {
      case 'tele': return '📹 Tele Consultation';
      case 'clinic': return '🏥 Clinic Visit';
      case 'home': return '🏠 Home Visit';
      case 'lab': return '🧪 Lab Test';
      case 'medicine': return '💊 Medicine Delivery';
      default: return 'Service';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Payment</h1>
            <p className="text-white/80 text-sm">Complete your booking</p>
          </div>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Booking Summary Card */}
        <Card className="p-4 bg-white border-2 border-orange-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📋</span>
            Booking Summary
          </h3>
          
          <div className="space-y-2.5">
            {/* Service Type */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Service</span>
              <span className="text-sm font-medium text-gray-900">{getServiceTypeLabel()}</span>
            </div>

            {/* Pet Details */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Pet</span>
              <span className="text-sm font-medium text-gray-900">
                {bookingDetails.petName} ({bookingDetails.petType})
              </span>
            </div>

            {/* Doctor/Vendor */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Doctor</span>
              <span className="text-sm font-medium text-gray-900">{bookingDetails.vendorName}</span>
            </div>

            {/* Date & Time */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Date & Time
              </span>
              <span className="text-sm font-medium text-gray-900">
                {new Date(bookingDetails.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {bookingDetails.scheduledTime}
              </span>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Duration
              </span>
              <span className="text-sm font-medium text-gray-900">{bookingDetails.serviceDuration} mins</span>
            </div>

            {/* Address (for home visits) */}
            {bookingDetails.address && (
              <div className="flex items-start justify-between py-2">
                <span className="text-sm text-gray-600">Address</span>
                <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
                  {bookingDetails.address}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Price Breakdown */}
        <Card className="p-4 bg-white">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>💰</span>
            Price Breakdown
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{bookingDetails.serviceName}</span>
              <span className="font-medium text-gray-900">₹{serviceCharge}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Platform Fee</span>
              <span className="font-medium text-gray-900">₹{platformFee}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-200">
              <span className="text-gray-600">GST (18%)</span>
              <span className="font-medium text-gray-900">₹{gst}</span>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <span className="font-semibold text-gray-900">Total Amount</span>
              <span className="font-bold text-[#FF8C42] text-xl">₹{totalAmount}</span>
            </div>
          </div>

          {/* Savings Badge */}
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700 text-center font-medium">
              🎉 You save ₹{Math.round(serviceCharge * 0.1)} with Warmpawz
            </p>
          </div>
        </Card>

        {/* Payment Methods */}
        <Card className="p-4 bg-white">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>💳</span>
            Select Payment Method
          </h3>

          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedPaymentMethod === method.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${method.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{method.name}</h4>
                      <p className="text-xs text-gray-500">{method.description}</p>
                    </div>
                    {selectedPaymentMethod === method.id && (
                      <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Secure Payment Badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <span>100% Secure & Encrypted Payment</span>
        </div>
      </div>

      {/* Pay Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 shadow-lg">
        <Button
          onClick={handlePayment}
          disabled={!selectedPaymentMethod || processing}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] hover:from-[#FF7029] hover:to-[#FF8C42] h-14 text-base font-semibold disabled:opacity-50"
        >
          {processing ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing Payment...
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span>Pay ₹{totalAmount}</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          )}
        </Button>
        <p className="text-xs text-center text-gray-500 mt-2">
          By proceeding, you agree to our Terms & Conditions
        </p>
      </div>
    </div>
  );
}
