'use client';

import React from 'react';
import { AlertCircle, RefreshCw, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentErrorProps {
  error: {
    code?: string;
    message: string;
    details?: string;
  };
  onRetry?: () => void;
  onContactSupport?: () => void;
}

export function PaymentError({ error, onRetry, onContactSupport }: PaymentErrorProps) {
  const getErrorDetails = () => {
    switch (error.code) {
      case 'PAYMENT_FAILED':
        return {
          title: 'Payment Failed',
          description: 'Your payment could not be processed. Please check your payment details and try again.',
          action: 'Retry Payment',
        };
      case 'INSUFFICIENT_FUNDS':
        return {
          title: 'Insufficient Funds',
          description: 'Your account does not have sufficient balance. Please use a different payment method.',
          action: 'Change Payment Method',
        };
      case 'CARD_DECLINED':
        return {
          title: 'Card Declined',
          description: 'Your card was declined by the bank. Please check your card details or use a different card.',
          action: 'Try Different Card',
        };
      case 'PAYMENT_TIMEOUT':
        return {
          title: 'Payment Timeout',
          description: 'The payment request timed out. Please try again.',
          action: 'Retry Payment',
        };
      case 'VERIFICATION_FAILED':
        return {
          title: 'Payment Verification Failed',
          description: 'We could not verify your payment. Please contact support if the amount was deducted.',
          action: 'Contact Support',
        };
      default:
        return {
          title: 'Payment Error',
          description: error.message || 'An error occurred while processing your payment.',
          action: 'Retry Payment',
        };
    }
  };

  const details = getErrorDetails();

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-red-900">{details.title}</CardTitle>
            <CardDescription className="text-red-700">{details.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error.details && (
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <p className="text-sm text-gray-600">{error.details}</p>
          </div>
        )}

        <div className="flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {details.action}
            </Button>
          )}
          {onContactSupport && (
            <Button
              onClick={onContactSupport}
              variant="outline"
              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Check your payment method details</p>
          <p>• Ensure you have sufficient balance</p>
          <p>• Try a different payment method</p>
          {error.code && <p>• Error Code: {error.code}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
