'use client';

import React from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NetworkErrorProps {
  error?: {
    message?: string;
  };
  onRetry?: () => void;
  onGoOffline?: () => void;
}

export function NetworkError({ error, onRetry, onGoOffline }: NetworkErrorProps) {
  return (
    <Card className="border-gray-200 bg-gray-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <CardTitle className="text-gray-900">No Internet Connection</CardTitle>
            <CardDescription className="text-gray-700">
              {error?.message || 'Please check your internet connection and try again.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
          {onGoOffline && (
            <Button
              onClick={onGoOffline}
              variant="outline"
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Continue Offline
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Check your Wi-Fi or mobile data connection</p>
          <p>• Try moving to an area with better signal</p>
          <p>• Restart your device if the problem persists</p>
        </div>
      </CardContent>
    </Card>
  );
}
