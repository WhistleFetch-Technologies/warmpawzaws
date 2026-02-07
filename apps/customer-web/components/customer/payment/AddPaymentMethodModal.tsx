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

  const handleSavePaymentMethod = async () => {
    setSaving(true);
    try {
      // This will be handled during Razorpay checkout
      // Razorpay provides an option to save cards during payment
      toast.info('Payment method will be saved during checkout. Select "Save card" option in Razorpay.');
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
            <div className="p-4 border-2 border-gray-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Credit/Debit Cards</span>
              </div>
              <p className="text-sm text-gray-500">
                Save your card for faster checkout. Only last 4 digits are stored.
              </p>
            </div>
            
            <div className="p-4 border-2 border-gray-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <Smartphone className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">UPI</span>
              </div>
              <p className="text-sm text-gray-500">
                Save your UPI ID for quick payments.
              </p>
            </div>
          </div>
          
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
          
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Payment methods are saved during Razorpay checkout. 
              Look for the "Save card" option when making your payment.
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
