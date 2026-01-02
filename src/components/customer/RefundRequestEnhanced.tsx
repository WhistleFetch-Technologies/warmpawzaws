import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { AlertCircle, Wallet, CreditCard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface RefundEstimate {
  paidAmount: number;
  refundPercentage: number;
  cancellationFee: number;
  estimatedRefund: number;
  hoursUntilService: number;
  policyApplied: any;
}

interface RefundRequestEnhancedProps {
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundRequestEnhanced({ bookingId, onClose, onSuccess }: RefundRequestEnhancedProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<RefundEstimate | null>(null);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');

  useEffect(() => {
    fetchEstimate();
  }, [bookingId]);

  const fetchEstimate = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/refunds/estimate/${bookingId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setEstimate(data);
      } else {
        toast.error('Failed to calculate refund estimate');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching refund details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/refunds/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            bookingId,
            reason,
            refundMethod
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Refund processed successfully');
        onSuccess();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to process refund');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error submitting refund request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Calculatiing refund eligibility...</div>;
  }

  if (!estimate) {
    return <div className="p-8 text-center text-red-500">Could not load refund details.</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-red-50 p-4 border-b border-red-100">
        <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Cancel Booking & Refund
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Breakdown */}
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
           <div className="flex justify-between text-sm">
             <span className="text-gray-600">Total Paid</span>
             <span className="font-medium">₹{estimate.paidAmount}</span>
           </div>
           <div className="flex justify-between text-sm">
             <span className="text-gray-600">Refund Eligibility ({estimate.refundPercentage}%)</span>
             <span className="text-green-600 font-medium">
               {estimate.refundPercentage < 100 ? `-₹${estimate.paidAmount - (estimate.paidAmount * estimate.refundPercentage / 100)}` : 'Full Refund'}
             </span>
           </div>
           {estimate.cancellationFee > 0 && (
             <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cancellation Fee</span>
                <span className="text-red-600 font-medium">-₹{estimate.cancellationFee}</span>
             </div>
           )}
           <div className="border-t border-gray-200 pt-2 flex justify-between items-center mt-2">
             <span className="font-bold text-gray-900">Total Refund</span>
             <span className="text-xl font-bold text-green-600">₹{estimate.estimatedRefund}</span>
           </div>
           <p className="text-xs text-gray-400 mt-1">
             Service is in {estimate.hoursUntilService} hours. Policy: {estimate.refundPercentage}% refund.
           </p>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Cancellation</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you want to cancel?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 min-h-[80px]"
          />
        </div>

        {/* Refund Method */}
        <div>
           <label className="block text-sm font-medium text-gray-700 mb-3">Refund Method</label>
           <RadioGroup value={refundMethod} onValueChange={(v: any) => setRefundMethod(v)} className="space-y-3">
              <div className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${refundMethod === 'wallet' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                 <RadioGroupItem value="wallet" id="wallet" />
                 <Label htmlFor="wallet" className="flex-1 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                       <Wallet className="w-5 h-5 text-green-600" />
                       <div>
                          <p className="font-semibold text-gray-900">Warmpawz Wallet</p>
                          <p className="text-xs text-green-700">Instant credit</p>
                       </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">Recommended</Badge>
                 </Label>
              </div>

              <div className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${refundMethod === 'original' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                 <RadioGroupItem value="original" id="original" />
                 <Label htmlFor="original" className="flex-1 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                       <CreditCard className="w-5 h-5 text-blue-600" />
                       <div>
                          <p className="font-semibold text-gray-900">Original Payment Source</p>
                          <p className="text-xs text-blue-700">5-7 business days</p>
                       </div>
                    </div>
                 </Label>
              </div>
           </RadioGroup>
        </div>

        <div className="flex gap-3 pt-4">
           <Button variant="outline" onClick={onClose} className="flex-1">Keep Booking</Button>
           <Button 
              onClick={handleConfirm} 
              disabled={submitting || !reason}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
           >
              {submitting ? 'Processing...' : 'Confirm Cancellation'}
           </Button>
        </div>
      </div>
    </div>
  );
}
