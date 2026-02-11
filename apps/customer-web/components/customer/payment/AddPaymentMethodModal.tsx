'use client';

import React, { useState } from 'react';
import { X, CreditCard, Smartphone, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AddPaymentMethodModalProps {
  customerPhone: string;
  customerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentMethodModal({
  customerPhone,
  customerId,
  onClose,
  onSuccess,
}: AddPaymentMethodModalProps) {
  const [saving, setSaving] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [methodType, setMethodType] = useState<'card' | 'upi'>('card');
  const [cardLast4, setCardLast4] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  const handleSavePaymentMethod = async () => {
    setSaving(true);
    try {
      if (!saveForFuture) {
        toast.info('Payment method not saved.');
        onSuccess();
        onClose();
        return;
      }

      if (!customerId && !customerPhone) {
        toast.error('Customer not found. Please log in again.');
        return;
      }

      if (methodType === 'card') {
        if (cardLast4.trim().length !== 4) {
          toast.error('Please enter the last 4 digits of the card.');
          return;
        }

        await apiClient.post('/customer/payment-methods', {
          customerId,
          phone: customerPhone,
          type: 'card',
          last4: cardLast4.trim(),
          brand: cardBrand.trim() || 'Card',
          bankName: bankName.trim() || undefined,
          isDefault: setAsDefault,
        });
      } else {
        if (!upiId.trim() || !upiId.includes('@')) {
          toast.error('Please enter a valid UPI ID.');
          return;
        }

        await apiClient.post('/customer/payment-methods', {
          customerId,
          phone: customerPhone,
          type: 'upi',
          upiId: upiId.trim(),
          bankName: bankName.trim() || undefined,
          isDefault: setAsDefault,
        });
      }

      toast.success('Payment method saved successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save payment method');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Save Payment Method</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 mb-1">Secure Payment Storage</p>
                <p className="text-sm text-gray-600">
                  Your payment methods are securely stored and encrypted. We never store your full card details.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setMethodType('card')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setMethodType('card');
              }}
              className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                methodType === 'card' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Credit/Debit Cards</span>
              </div>
              <p className="text-sm text-gray-500">
                Save your card for faster checkout. Only last 4 digits are stored.
              </p>
            </div>
            
            <div
              role="button"
              tabIndex={0}
              onClick={() => setMethodType('upi')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setMethodType('upi');
              }}
              className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                methodType === 'upi' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Smartphone className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">UPI</span>
              </div>
              <p className="text-sm text-gray-500">
                Save your UPI ID for quick payments.
              </p>
            </div>
          </div>

          {methodType === 'card' ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Card brand (e.g., Visa)"
                value={cardBrand}
                onChange={(e) => setCardBrand(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Last 4 digits"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <input
                type="text"
                placeholder="Bank name (optional)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="UPI ID (e.g., name@bank)"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <input
                type="text"
                placeholder="Bank name (optional)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          )}
          
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="saveForFuture"
              checked={saveForFuture}
              onChange={(e) => setSaveForFuture(e.target.checked)}
              className="w-5 h-5 text-[#FF8C42] rounded border-gray-300"
            />
            <label htmlFor="saveForFuture" className="flex-1 text-sm text-gray-700">
              Save payment method for future use
            </label>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="setAsDefault"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="w-5 h-5 text-[#FF8C42] rounded border-gray-300"
            />
            <label htmlFor="setAsDefault" className="flex-1 text-sm text-gray-700">
              Set as default payment method
            </label>
          </div>
          
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Card tokens are stored securely. You can also save during Razorpay checkout.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSavePaymentMethod}
            disabled={saving}
            className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35] text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Continue
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AddPaymentMethodModal;
