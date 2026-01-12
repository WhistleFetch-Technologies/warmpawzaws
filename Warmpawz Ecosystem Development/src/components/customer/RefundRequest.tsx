import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, DollarSign, Info } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface RefundRequestProps {
  bookingId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RefundRequest({ bookingId, onSuccess, onCancel }: RefundRequestProps) {
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadRefundPolicy();
  }, [bookingId]);

  const loadRefundPolicy = async () => {
    try {
      const response = await fetch(`${API_BASE}/refunds/policy/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPolicy(data.policy);
        }
      }
    } catch (error) {
      console.error('Failed to load refund policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/refunds/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ bookingId, reason, refundMethod })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Refund request submitted successfully!');
          onSuccess?.();
        }
      }
    } catch (error) {
      console.error('Failed to request refund:', error);
      alert('Failed to submit refund request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <p className="text-gray-600">Loading refund policy...</p>
      </Card>
    );
  }

  if (!policy) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-900 font-semibold">Unable to load refund policy</p>
      </Card>
    );
  }

  const { currentRefund } = policy;
  const canRefund = currentRefund.refundPercentage > 0;

  return (
    <div className="space-y-6">
      {/* Refund Amount Card */}
      <Card className={`p-6 ${canRefund ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-start gap-4">
          {canRefund ? (
            <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600 mt-1" />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">
              {canRefund ? 'Refund Available' : 'No Refund Available'}
            </h3>
            <p className="text-sm text-gray-700 mb-3">{currentRefund.reason}</p>
            
            {canRefund && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Booking Amount:</span>
                  <span className="font-semibold">₹{currentRefund.refundableAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Refund Percentage:</span>
                  <span className="font-semibold">{currentRefund.refundPercentage}%</span>
                </div>
                {currentRefund.processingFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Processing Fee:</span>
                    <span className="font-semibold text-red-600">-₹{currentRefund.processingFee}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-green-200">
                  <span className="font-semibold text-gray-900">You will receive:</span>
                  <span className="text-2xl font-bold text-green-600">₹{currentRefund.netRefund.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Policy Rules */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Cancellation Policy</h4>
            <ul className="space-y-2">
              {policy.rules.map((rule: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {canRefund && (
        <>
          {/* Refund Method */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Refund Method</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="refundMethod"
                  value="wallet"
                  checked={refundMethod === 'wallet'}
                  onChange={(e) => setRefundMethod(e.target.value as 'wallet')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Wallet (Instant)</div>
                  <div className="text-sm text-gray-600">Refund to your Warmpawz wallet instantly</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="refundMethod"
                  value="original"
                  checked={refundMethod === 'original'}
                  onChange={(e) => setRefundMethod(e.target.value as 'original')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Original Payment Method</div>
                  <div className="text-sm text-gray-600">Refund to your original payment method (5-7 days)</div>
                </div>
              </label>
            </div>
          </Card>

          {/* Reason */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Reason for Cancellation *</h4>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for cancellation..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Submitting...' : 'Submit Cancellation Request'}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={submitting}>
                Go Back
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
