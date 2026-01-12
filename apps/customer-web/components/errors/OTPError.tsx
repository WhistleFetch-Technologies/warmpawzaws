'use client';

import React from 'react';
import { Clock, RefreshCw, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OTPErrorProps {
  error: {
    type: 'expired' | 'invalid' | 'max_attempts' | 'not_found' | 'generic';
    message: string;
    remainingAttempts?: number;
  };
  onRetry?: () => void;
  onGenerateNew?: () => void;
}

export function OTPError({ error, onRetry, onGenerateNew }: OTPErrorProps) {
  const getErrorDetails = () => {
    switch (error.type) {
      case 'expired':
        return {
          title: 'OTP Expired',
          description: 'This OTP has expired. Please generate a new one.',
          icon: Clock,
          action: 'Generate New OTP',
        };
      case 'invalid':
        return {
          title: 'Invalid OTP',
          description: 'The OTP you entered is incorrect. Please check and try again.',
          icon: Key,
          action: 'Try Again',
          showAttempts: true,
        };
      case 'max_attempts':
        return {
          title: 'Maximum Attempts Reached',
          description: 'You have exceeded the maximum number of attempts. Please generate a new OTP.',
          icon: Clock,
          action: 'Generate New OTP',
        };
      case 'not_found':
        return {
          title: 'OTP Not Found',
          description: 'This OTP is no longer valid. Please generate a new one.',
          icon: Key,
          action: 'Generate New OTP',
        };
      default:
        return {
          title: 'OTP Error',
          description: error.message || 'An error occurred with OTP verification.',
          icon: Key,
          action: 'Try Again',
        };
    }
  };

  const details = getErrorDetails();
  const Icon = details.icon;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Icon className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-orange-900">{details.title}</CardTitle>
            <CardDescription className="text-orange-700">{details.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {details.showAttempts && error.remainingAttempts !== undefined && (
          <div className="bg-white rounded-lg p-3 border border-orange-200">
            <p className="text-sm text-gray-600">
              Remaining attempts: <span className="font-semibold">{error.remainingAttempts}</span>
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {error.type === 'expired' || error.type === 'max_attempts' || error.type === 'not_found' ? (
            onGenerateNew && (
              <Button
                onClick={onGenerateNew}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {details.action}
              </Button>
            )
          ) : (
            onRetry && (
              <Button
                onClick={onRetry}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {details.action}
              </Button>
            )
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• OTPs are valid for 10 minutes</p>
          <p>• You have 3 attempts to enter the correct OTP</p>
          <p>• Check for any typos in the OTP</p>
          {error.type === 'expired' && <p>• Generate a new OTP from your booking details</p>}
        </div>
      </CardContent>
    </Card>
  );
}
