'use client';

import React from 'react';
import { DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettlementErrorProps {
  error: {
    type: 'processing_failed' | 'payout_failed' | 'verification_failed' | 'generic';
    message: string;
  };
  onRetry?: () => void;
  onContactSupport?: () => void;
}

export function SettlementError({ error, onRetry, onContactSupport }: SettlementErrorProps) {
  const getErrorDetails = () => {
    switch (error.type) {
      case 'processing_failed':
        return {
          title: 'Settlement Processing Failed',
          description: 'Failed to process the settlement. Please contact support for assistance.',
          action: 'Contact Support',
        };
      case 'payout_failed':
        return {
          title: 'Payout Failed',
          description: 'The payout to your account failed. Please verify your bank details.',
          action: 'Update Bank Details',
        };
      case 'verification_failed':
        return {
          title: 'Bank Verification Failed',
          description: 'Your bank account verification failed. Please update your bank details.',
          action: 'Update Bank Details',
        };
      default:
        return {
          title: 'Settlement Error',
          description: error.message || 'An error occurred while processing the settlement.',
          action: 'Retry',
        };
    }
  };

  const details = getErrorDetails();

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-purple-900">{details.title}</CardTitle>
            <CardDescription className="text-purple-700">{details.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {details.action}
            </Button>
          )}
          {onContactSupport && (
            <Button
              onClick={onContactSupport}
              variant="outline"
              className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Settlements are processed within 7 days</p>
          <p>• Ensure your bank account is verified</p>
          <p>• Contact support if the issue persists</p>
        </div>
      </CardContent>
    </Card>
  );
}
