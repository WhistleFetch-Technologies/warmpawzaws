'use client';

/**
 * PackageAwareBookingFlow - Wraps booking flow to detect and use active packages
 * 
 * Features:
 * - Checks if customer has active packages with the vendor
 * - Offers "Use Package Session" vs "Book New" options
 * - Seamlessly integrates with existing booking flow
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Package, Calendar, CreditCard, Clock, ChevronRight, CheckCircle, Gift, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActivePackage {
  id: string;
  packageName: string;
  vendorName: string;
  totalSessions: number;
  remainingSessions: number | 'unlimited';
  sessionsUsed: number;
  expiresAt: string | null;
  isUnlimited: boolean;
  packageType: string;
}

interface PackageAwareBookingFlowProps {
  customerId: string;
  vendorId: string;
  serviceType?: string;
  petId?: string;
  serviceId?: string;
  onBookingComplete?: (booking: any) => void;
  onUsePackage?: (packageId: string) => void;
  onBookNew?: () => void;
  children?: React.ReactNode;
}

export function PackageAwareBookingFlow({
  customerId,
  vendorId,
  serviceType,
  petId,
  serviceId,
  onBookingComplete,
  onUsePackage,
  onBookNew,
  children
}: PackageAwareBookingFlowProps) {
  const [loading, setLoading] = useState(true);
  const [activePackage, setActivePackage] = useState<ActivePackage | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    checkForActivePackages();
  }, [customerId, vendorId, serviceType]);

  const checkForActivePackages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}${serviceType ? `&serviceType=${serviceType}` : ''}`
      );

      if (response?.hasActivePackage && response?.package) {
        setActivePackage(response.package);
        setShowPackageModal(true);
      } else {
        setActivePackage(null);
        // No active package - proceed to normal booking
        if (onBookNew) onBookNew();
      }
    } catch (error) {
      console.error('Error checking packages:', error);
      // On error, proceed to normal booking
      if (onBookNew) onBookNew();
    } finally {
      setLoading(false);
    }
  };

  const handleUsePackage = async () => {
    if (!activePackage || !selectedDate || !selectedTime) {
      toast.error('Please select a date and time');
      return;
    }

    try {
      setBooking(true);
      
      const response = await apiClient.post<any>('/bookings/create-from-package', {
        packagePurchaseId: activePackage.id,
        customerId,
        vendorId,
        petId,
        serviceId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        serviceType: serviceType || 'at_center'
      });

      if (response?.success) {
        toast.success(response.message || 'Booking created from package!');
        setShowPackageModal(false);
        if (onBookingComplete) onBookingComplete(response.booking);
        if (onUsePackage) onUsePackage(activePackage.id);
      } else {
        toast.error(response?.error || 'Failed to create booking');
      }
    } catch (error: any) {
      console.error('Error using package:', error);
      toast.error(error.message || 'Failed to use package session');
    } finally {
      setBooking(false);
    }
  };

  const handleBookNew = () => {
    setShowPackageModal(false);
    if (onBookNew) onBookNew();
  };

  const formatExpiryDate = (dateStr: string | null) => {
    if (!dateStr) return 'No expiry';
    const date = new Date(dateStr);
    const now = new Date();
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return '1 day left';
    if (daysLeft <= 7) return `${daysLeft} days left`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Generate available dates (next 14 days)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Time slots
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        <span className="ml-3 text-gray-600">Checking for packages...</span>
      </div>
    );
  }

  if (!showPackageModal) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Package Selection Modal */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6" />
                <h2 className="text-xl font-bold">Active Package Found!</h2>
              </div>
              <button 
                onClick={() => setShowPackageModal(false)}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/90 text-sm">
              You have an active package with this provider
            </p>
          </div>

          {/* Package Details */}
          <div className="p-6">
            <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{activePackage?.packageName}</h3>
                  <p className="text-sm text-gray-600">{activePackage?.vendorName}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      {activePackage?.isUnlimited 
                        ? 'Unlimited sessions' 
                        : `${activePackage?.remainingSessions}/${activePackage?.totalSessions} sessions left`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatExpiryDate(activePackage?.expiresAt || null)}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {activePackage && !activePackage.isUnlimited && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Package Progress</span>
                  <span className="font-medium text-gray-900">
                    {activePackage.sessionsUsed}/{activePackage.totalSessions} used
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                    style={{ 
                      width: `${(activePackage.sessionsUsed / (activePackage.totalSessions as number)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Schedule Selection */}
            <div className="space-y-4 mb-6">
              <h4 className="font-semibold text-gray-900">Select Date & Time</h4>
              
              {/* Date Selection */}
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Date</label>
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {getAvailableDates().map(date => {
                    const dateObj = new Date(date);
                    const isSelected = selectedDate === date;
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`p-2 rounded-lg text-center transition ${
                          isSelected 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="text-xs font-medium">
                          {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                        <div className="text-sm font-bold">
                          {dateObj.getDate()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Time</label>
                <div className="grid grid-cols-5 gap-2">
                  {timeSlots.map(time => {
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`p-2 rounded-lg text-center transition text-sm ${
                          isSelected 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleUsePackage}
                disabled={booking || !selectedDate || !selectedTime}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-6 text-lg font-bold rounded-xl"
              >
                {booking ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5 mr-2" />
                    Use Package Session
                    <span className="ml-2 text-sm font-normal opacity-90">FREE</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleBookNew}
                className="w-full py-4 text-gray-700 border-2"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Book as New (Pay Separately)
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <p className="text-center text-xs text-gray-500 mt-4">
              Using a package session is free and will be deducted from your remaining sessions.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default PackageAwareBookingFlow;
