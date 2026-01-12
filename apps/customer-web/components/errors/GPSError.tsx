'use client';

import React from 'react';
import { MapPin, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GPSErrorProps {
  error: {
    type: 'not_active' | 'connection_failed' | 'permission_denied' | 'timeout' | 'generic';
    message: string;
  };
  onRetry?: () => void;
  onContactSupport?: () => void;
}

export function GPSError({ error, onRetry, onContactSupport }: GPSErrorProps) {
  const getErrorDetails = () => {
    switch (error.type) {
      case 'not_active':
        return {
          title: 'GPS Tracking Not Active',
          description: 'GPS tracking is not active for this booking. The service provider may not have started tracking yet.',
          icon: MapPin,
          action: 'Refresh',
        };
      case 'connection_failed':
        return {
          title: 'Connection Failed',
          description: 'Failed to connect to GPS tracking service. Please check your internet connection.',
          icon: WifiOff,
          action: 'Retry',
        };
      case 'permission_denied':
        return {
          title: 'Location Permission Denied',
          description: 'Location permission is required for GPS tracking. Please enable location services.',
          icon: MapPin,
          action: 'Enable Location',
        };
      case 'timeout':
        return {
          title: 'Tracking Timeout',
          description: 'The tracking request timed out. Please try again.',
          icon: MapPin,
          action: 'Retry',
        };
      default:
        return {
          title: 'GPS Tracking Error',
          description: error.message || 'An error occurred while loading GPS tracking.',
          icon: MapPin,
          action: 'Retry',
        };
    }
  };

  const details = getErrorDetails();
  const Icon = details.icon;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-blue-900">{details.title}</CardTitle>
            <CardDescription className="text-blue-700">{details.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {details.action}
            </Button>
          )}
          {onContactSupport && (
            <Button
              onClick={onContactSupport}
              variant="outline"
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Contact Support
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• GPS tracking is only available for home services</p>
          <p>• Tracking starts when the service provider begins their journey</p>
          <p>• Ensure you have a stable internet connection</p>
          {error.type === 'not_active' && (
            <p>• Contact the service provider if tracking doesn't start</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
