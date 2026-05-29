'use client';

import React, { memo } from 'react';
import { AlertCircle, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ActiveBookingItem {
  id: string;
  serviceName?: string;
  vendorName?: string;
  estimatedArrival?: string;
}

export interface ActiveBookingsSectionProps {
  activeBookings: ActiveBookingItem[];
  onViewBooking?: (bookingId: string) => void;
  className?: string;
}

function ActiveBookingsSectionComponent({
  activeBookings,
  onViewBooking,
  className = '',
}: ActiveBookingsSectionProps) {
  if (activeBookings.length === 0) return null;

  return (
    <div className={`px-4 mb-4 ${className}`}>
      <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">Active Service</h3>
            <p className="text-sm text-gray-600">Provider is on the way</p>
          </div>
        </div>

        {activeBookings.map((booking) => (
          <div key={booking.id} className="mb-2 rounded-xl bg-white p-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{booking.serviceName || 'Service'}</h4>
                <p className="text-xs text-gray-500">{booking.vendorName || 'Provider'}</p>
              </div>
              <Button
                size="sm"
                onClick={() => onViewBooking?.(booking.id)}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Navigation className="mr-1 h-4 w-4" />
                Track
              </Button>
            </div>
            {booking.estimatedArrival ? (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <Clock className="h-4 w-4" />
                <span>ETA: {booking.estimatedArrival}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Active in-progress bookings with track CTA — hidden when list is empty. */
export const ActiveBookingsSection = memo(ActiveBookingsSectionComponent);
