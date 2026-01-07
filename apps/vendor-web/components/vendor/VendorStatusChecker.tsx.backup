'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface VendorStatusCheckerProps {
  vendorId: string;
  onStatusChange?: (status: string) => void;
}

export function VendorStatusChecker({ vendorId, onStatusChange }: VendorStatusCheckerProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [vendorId]);

  const checkStatus = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/status/${vendorId}`);
      if (response.success && response.status) {
        setStatus(response.status);
        setLastChecked(new Date());
        if (onStatusChange) {
          onStatusChange(response.status);
        }
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (currentStatus: string | null) => {
    switch (currentStatus) {
      case 'approved':
      case 'active':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-600" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          message: 'Your account is active and ready to use',
        };
      case 'pending':
      case 'under_review':
        return {
          icon: <Clock className="w-8 h-8 text-yellow-600" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          message: 'Your application is under review',
        };
      case 'rejected':
        return {
          icon: <XCircle className="w-8 h-8 text-red-600" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          message: 'Your application was rejected',
        };
      case 'clarification_requested':
        return {
          icon: <AlertCircle className="w-8 h-8 text-orange-600" />,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          message: 'Additional information is required',
        };
      default:
        return {
          icon: <AlertCircle className="w-8 h-8 text-gray-600" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          message: 'Status unknown',
        };
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const config = getStatusConfig(status);

  return (
    <div className={`rounded-xl border-2 ${config.borderColor} ${config.bgColor} p-6`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${config.color} mb-1`}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'Unknown Status'}
          </h3>
          <p className="text-sm text-gray-700">{config.message}</p>
          {lastChecked && (
            <p className="text-xs text-gray-500 mt-2">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

