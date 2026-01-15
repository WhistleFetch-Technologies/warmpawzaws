'use client';

/**
 * ActivePackageCard - Shows active package status on service dashboards
 * 
 * Features:
 * - Progress bar for sessions used
 * - Quick "Book from Package" button
 * - Expiry countdown
 * - View package details
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Package, Calendar, Clock, ChevronRight, 
  CheckCircle, AlertCircle, TrendingUp, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActivePackageData {
  id: string;
  packageName: string;
  vendorName: string;
  vendorId: string;
  totalSessions: number;
  remainingSessions: number;
  sessionsUsed: number;
  expiresAt: string | null;
  isUnlimited: boolean;
  nextSession?: {
    scheduledDate: string;
    scheduledTime: string;
    status: string;
  };
  computedStatus: string;
}

interface ActivePackageCardProps {
  customerId: string;
  serviceType?: string;
  vendorId?: string;
  onBookFromPackage?: (packageId: string, vendorId: string) => void;
  onViewPackage?: (packageId: string) => void;
  className?: string;
  compact?: boolean;
}

export function ActivePackageCard({
  customerId,
  serviceType,
  vendorId,
  onBookFromPackage,
  onViewPackage,
  className = '',
  compact = false
}: ActivePackageCardProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ActivePackageData[]>([]);

  useEffect(() => {
    fetchActivePackages();
  }, [customerId, serviceType, vendorId]);

  const fetchActivePackages = async () => {
    try {
      setLoading(true);
      let url = `/customer/${customerId}/packages/active`;
      const params = new URLSearchParams();
      if (serviceType) params.append('serviceType', serviceType);
      if (vendorId) params.append('vendorId', vendorId);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await apiClient.get<any>(url);
      
      if (response?.packages) {
        setPackages(response.packages);
      }
    } catch (error) {
      console.error('Error fetching active packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatExpiryDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return { text: 'Expired', urgent: true };
    if (daysLeft === 1) return { text: '1 day left', urgent: true };
    if (daysLeft <= 7) return { text: `${daysLeft} days left`, urgent: true };
    if (daysLeft <= 30) return { text: `${daysLeft} days left`, urgent: false };
    return { 
      text: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      urgent: false 
    };
  };

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(date);
    return `${dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-8 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (packages.length === 0) {
    return null;
  }

  if (compact) {
    const pkg = packages[0]; // Show first package in compact mode
    const progressPercent = pkg.isUnlimited ? 100 : ((pkg.sessionsUsed / pkg.totalSessions) * 100);
    const expiry = formatExpiryDate(pkg.expiresAt);

    return (
      <button
        onClick={() => onBookFromPackage?.(pkg.id, pkg.vendorId)}
        className={`w-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3 text-left hover:shadow-md transition ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{pkg.packageName}</p>
              <p className="text-xs text-gray-600">
                {pkg.isUnlimited ? 'Unlimited' : `${pkg.remainingSessions} sessions left`}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-orange-500" />
        </div>
      </button>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Gift className="w-5 h-5 text-orange-500" />
          Your Active Packages
        </h3>
        <span className="text-xs text-gray-500">{packages.length} active</span>
      </div>

      {packages.map((pkg) => {
        const progressPercent = pkg.isUnlimited ? 0 : ((pkg.sessionsUsed / pkg.totalSessions) * 100);
        const expiry = formatExpiryDate(pkg.expiresAt);

        return (
          <div 
            key={pkg.id}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{pkg.packageName}</h4>
                  <p className="text-sm text-gray-600">{pkg.vendorName}</p>
                </div>
              </div>
              
              {expiry && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  expiry.urgent 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {expiry.urgent && <AlertCircle className="w-3 h-3 inline mr-1" />}
                  {expiry.text}
                </span>
              )}
            </div>

            {/* Progress */}
            {!pkg.isUnlimited && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Sessions Used</span>
                  <span className="font-semibold text-gray-900">
                    {pkg.sessionsUsed}/{pkg.totalSessions}
                  </span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-green-600 mt-1 font-medium">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {pkg.remainingSessions} sessions remaining
                </p>
              </div>
            )}

            {pkg.isUnlimited && (
              <div className="mb-3 flex items-center gap-2 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Unlimited Sessions</span>
              </div>
            )}

            {/* Next Session */}
            {pkg.nextSession && (
              <div className="bg-white rounded-lg p-3 mb-3 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs text-gray-500">Next Session</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(pkg.nextSession.scheduledDate, pkg.nextSession.scheduledTime)}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => onBookFromPackage?.(pkg.id, pkg.vendorId)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                size="sm"
              >
                <Calendar className="w-4 h-4 mr-1" />
                Book Session
              </Button>
              <Button
                variant="outline"
                onClick={() => onViewPackage?.(pkg.id)}
                size="sm"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                View Details
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivePackageCard;
