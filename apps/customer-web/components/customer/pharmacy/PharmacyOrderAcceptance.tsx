'use client';

/**
 * ============================================================================
 * PHARMACY ORDER ACCEPTANCE - Waiting for Invoice & Approval Flow
 * ============================================================================
 * 
 * Features:
 * - "Your order has been accepted" celebration
 * - "Checking medicine availability" status
 * - Invoice preview with fee breakdown
 * - Approve & Pay flow
 * 
 * Design: Clear step-by-step acceptance flow
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Clock, Package, Pill, FileText, AlertCircle,
  CreditCard, Wallet, Building2, MapPin, Phone, ChevronRight,
  Loader2, Download, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MedicineAvailability {
  name: string;
  quantity: number;
  unitPrice: number;
  available: boolean;
  substituteAvailable?: boolean;
  substituteName?: string;
  substitutePrice?: number;
}

interface Invoice {
  id: string;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  convenienceFee: number;
  gst?: number;
  discount?: number;
  total: number;
  items: MedicineAvailability[];
}

type AcceptancePhase = 'accepted' | 'checking_availability' | 'invoice_ready' | 'approved' | 'payment';

interface PharmacyOrderAcceptanceProps {
  orderId: string;
  pharmacy: {
    name: string;
    address: string;
    phone?: string;
    distance: number;
    rating?: number;
  };
  phase: AcceptancePhase;
  medicines: MedicineAvailability[];
  invoice?: Invoice;
  onApproveInvoice?: () => void;
  onPayNow?: (paymentMethod: 'online' | 'cod') => void;
  onCallPharmacy?: () => void;
  isLoading?: boolean;
}

export function PharmacyOrderAcceptance({
  orderId,
  pharmacy,
  phase,
  medicines,
  invoice,
  onApproveInvoice,
  onPayNow,
  onCallPharmacy,
  isLoading = false
}: PharmacyOrderAcceptanceProps) {
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [invoiceApproved, setInvoiceApproved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Show celebration when order is first accepted
  useEffect(() => {
    if (phase === 'accepted') {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const availableMedicines = medicines.filter(m => m.available);
  const unavailableMedicines = medicines.filter(m => !m.available);

  const getPhaseConfig = () => {
    switch (phase) {
      case 'accepted':
        return {
          icon: CheckCircle2,
          title: 'Order Accepted!',
          subtitle: 'A pharmacy has accepted your order',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'checking_availability':
        return {
          icon: Package,
          title: 'Checking Availability',
          subtitle: 'Pharmacy is verifying medicine stock',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'invoice_ready':
        return {
          icon: FileText,
          title: 'Invoice Ready',
          subtitle: 'Please review and approve the bill',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'approved':
        return {
          icon: CreditCard,
          title: 'Complete Payment',
          subtitle: 'Choose your payment method',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        };
      case 'payment':
        return {
          icon: Wallet,
          title: 'Processing Payment',
          subtitle: 'Please wait while we confirm',
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          borderColor: 'border-indigo-200'
        };
    }
  };

  const config = getPhaseConfig();
  const PhaseIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Celebration Animation for Acceptance */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-8 max-w-sm mx-4 text-center shadow-2xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <motion.div
                className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
              >
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Great News!</h2>
              <p className="text-gray-600 mb-4">Your order has been accepted by</p>
              <p className="text-lg font-semibold text-green-600">{pharmacy.name}</p>
              <p className="text-sm text-gray-500 mt-2">{pharmacy.distance.toFixed(1)} km away</p>
              
              {/* Confetti-like elements */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'][i % 5],
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1, 0],
                    y: [0, -50, -100],
                    x: [(Math.random() - 0.5) * 100]
                  }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase Status Card */}
      <motion.div
        className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} p-6`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}
            animate={phase === 'checking_availability' || phase === 'payment' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: phase === 'checking_availability' || phase === 'payment' ? Infinity : 0 }}
          >
            {isLoading ? (
              <Loader2 className={`w-8 h-8 ${config.color} animate-spin`} />
            ) : (
              <PhaseIcon className={`w-8 h-8 ${config.color}`} />
            )}
          </motion.div>
          <div>
            <h2 className={`text-xl font-bold ${config.color}`}>{config.title}</h2>
            <p className="text-gray-600">{config.subtitle}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            {['Accepted', 'Checking', 'Invoice', 'Pay', 'Dispatch'].map((step, index) => {
              const phases: AcceptancePhase[] = ['accepted', 'checking_availability', 'invoice_ready', 'approved', 'payment'];
              const currentIndex = phases.indexOf(phase);
              const isCompleted = index < currentIndex || (index === currentIndex && phase !== 'payment');
              const isCurrent = index === currentIndex;
              
              return (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isCurrent 
                        ? `${config.bgColor} ${config.color} border-2 ${config.borderColor}`
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs ${isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Pharmacy Info */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{pharmacy.name}</h3>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="w-4 h-4" />
              <span>{pharmacy.address}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="text-green-600 border-green-200">
                {pharmacy.distance.toFixed(1)} km away
              </Badge>
              {pharmacy.rating && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                  ⭐ {pharmacy.rating.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>
          {pharmacy.phone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `tel:${pharmacy.phone}`}
            >
              <Phone className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Medicine Availability - Show during checking phase */}
      {(phase === 'checking_availability' || phase === 'invoice_ready' || phase === 'approved') && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-orange-500" />
            Medicine Availability
          </h3>
          
          <div className="space-y-3">
            {/* Available Medicines */}
            {availableMedicines.map((medicine, idx) => (
              <motion.div
                key={idx}
                className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{medicine.name}</p>
                    <p className="text-sm text-gray-500">Qty: {medicine.quantity}</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">₹{(medicine.quantity * medicine.unitPrice).toFixed(2)}</p>
              </motion.div>
            ))}

            {/* Unavailable Medicines */}
            {unavailableMedicines.map((medicine, idx) => (
              <motion.div
                key={idx}
                className="p-3 bg-red-50 rounded-xl border border-red-100"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (availableMedicines.length + idx) * 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-medium text-gray-900 line-through">{medicine.name}</p>
                      <p className="text-sm text-red-600">Out of stock</p>
                    </div>
                  </div>
                </div>
                {medicine.substituteAvailable && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm text-gray-600 mb-2">Alternative available:</p>
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <div>
                        <p className="font-medium text-green-700">{medicine.substituteName}</p>
                        <p className="text-xs text-gray-500">Same composition</p>
                      </div>
                      <p className="font-semibold text-green-600">₹{medicine.substitutePrice?.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Invoice Details - Show when invoice is ready */}
      {invoice && (phase === 'invoice_ready' || phase === 'approved' || phase === 'payment') && (
        <Card className="p-5 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-orange-500" />
              Bill Summary
            </h3>
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              Invoice #{invoice.id.slice(-6)}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {/* Items subtotal */}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span>Items Total ({availableMedicines.length} items)</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.discount && invoice.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount Applied</span>
                  <span>- ₹{invoice.discount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-2 py-3 border-y border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery Charges</span>
                <span className="font-medium">₹{invoice.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="font-medium">₹{invoice.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Convenience Fee</span>
                <span className="font-medium">₹{invoice.convenienceFee.toFixed(2)}</span>
              </div>
              {invoice.gst && invoice.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST (18%)</span>
                  <span className="font-medium">₹{invoice.gst.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-bold text-gray-900">Total Amount</span>
              <span className="text-2xl font-bold text-orange-600">₹{invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Approval Checkbox - Show on invoice_ready phase */}
          {phase === 'invoice_ready' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-blue-50 rounded-xl border border-blue-200">
                <input
                  type="checkbox"
                  checked={invoiceApproved}
                  onChange={(e) => setInvoiceApproved(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <p className="font-semibold text-gray-900">I approve this invoice</p>
                  <p className="text-sm text-gray-600">
                    I agree to pay ₹{invoice.total.toFixed(2)} including all fees and charges
                  </p>
                </div>
              </label>
              
              <Button
                onClick={onApproveInvoice}
                disabled={!invoiceApproved || isLoading}
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Approve & Continue to Pay
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Payment Method Selection - Show on approved phase */}
      {phase === 'approved' && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-500" />
            Payment Method
          </h3>
          
          <div className="space-y-3">
            <motion.button
              onClick={() => setPaymentMethod('online')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                paymentMethod === 'online'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <CreditCard className={`w-6 h-6 ${paymentMethod === 'online' ? 'text-orange-500' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Pay Online</p>
                  <p className="text-sm text-gray-500">UPI, Cards, Net Banking, Wallets</p>
                </div>
                {paymentMethod === 'online' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
              </div>
            </motion.button>
            
            <motion.button
              onClick={() => setPaymentMethod('cod')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                paymentMethod === 'cod'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <Wallet className={`w-6 h-6 ${paymentMethod === 'cod' ? 'text-orange-500' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Cash on Delivery</p>
                  <p className="text-sm text-gray-500">Pay when you receive</p>
                </div>
                {paymentMethod === 'cod' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
              </div>
            </motion.button>
          </div>

          <Button
            onClick={() => onPayNow?.(paymentMethod)}
            disabled={isLoading}
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {paymentMethod === 'online' ? 'Pay Now' : 'Confirm Order'}
                <span className="ml-2">₹{invoice?.total.toFixed(2)}</span>
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
