'use client';

/**
 * Rule 4: Large on-screen notification when vendor gets a new appointment/order.
 * Shows customer name, service name, type (home/tele/center), distance if home, date/time.
 * Loud notification - use with playOrderAlertSound when showing.
 */

import { useEffect, useState } from 'react';
import { Calendar, User, MapPin, Video, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playOrderAlertSound } from '@/lib/audio-alerts';
import { DeclineBookingModal } from '@/components/vendor/DeclineBookingModal';

export interface NewBookingAlertData {
  bookingId: string;
  customerId?: string;
  customerName: string;
  serviceName: string;
  serviceType: string;
  bookingDate: string;
  bookingTime: string;
  address?: string | Record<string, unknown>;
  distanceKm?: number;
}

interface VendorNewBookingOrderAlertProps {
  notification: {
    type: string;
    title?: string;
    message?: string;
    data?: string | NewBookingAlertData;
  };
  vendorId: string;
  onView: (bookingId: string) => void;
  onDismiss: () => void;
  playSound?: boolean;
}

export function VendorNewBookingOrderAlert({
  notification,
  vendorId,
  onView,
  onDismiss,
  playSound = true,
}: VendorNewBookingOrderAlertProps) {
  const [showDecline, setShowDecline] = useState(false);
  const data: NewBookingAlertData | null =
    typeof notification.data === 'string'
      ? (() => {
          try {
            return JSON.parse(notification.data) as NewBookingAlertData;
          } catch {
            return null;
          }
        })()
      : (notification.data as NewBookingAlertData) || null;

  useEffect(() => {
    if (playSound) {
      playOrderAlertSound();
    }
  }, [playSound]);

  const customerName = data?.customerName || 'Customer';
  const serviceName = data?.serviceName || 'Service';
  const serviceType = data?.serviceType || '';
  const typeLabel =
    serviceType === 'at_home' || serviceType === 'home'
      ? 'Home visit'
      : serviceType === 'tele'
        ? 'Tele consultation'
        : 'At center';
  const Icon =
    serviceType === 'tele' ? Video : serviceType === 'at_home' || serviceType === 'home' ? MapPin : Building2;
  const dateTime = data
    ? `${data.bookingDate || ''} ${data.bookingTime || ''}`.trim()
    : notification.message || '';

  // When decline opens, unmount this overlay — Dialog is z-[60]/[70]; this shell is z-[90] and would sit on top and steal clicks.
  return (
    <>
      {!showDecline && (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium opacity-90">New appointment</span>
            <button
              onClick={onDismiss}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-xl font-bold mt-2">New booking confirmed</h2>
          <p className="text-sm opacity-90 mt-1">The slot was available — no accept step needed.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <User className="w-6 h-6 text-[#FF8C42]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{customerName}</p>
              <p className="text-sm text-gray-600">{serviceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icon className="w-4 h-4 text-[#FF8C42]" />
            <span>{typeLabel}</span>
            {data?.distanceKm != null && (
              <span className="text-gray-500">• {data.distanceKm.toFixed(1)} km</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-[#FF8C42]" />
            <span>{dateTime}</span>
          </div>
          {data?.address && (
            <p className="text-sm text-gray-500 truncate">
              {typeof data.address === 'string' ? data.address : (data.address as any)?.address || ''}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
              <Button
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7829]"
                onClick={() => {
                  if (data?.bookingId) onView(data.bookingId);
                  onDismiss();
                }}
              >
                View details
              </Button>
            </div>
            {vendorId && data?.bookingId && (
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setShowDecline(true)}
              >
                Decline booking (refund per policy)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
      )}

      {showDecline && vendorId && data?.bookingId && (
        <DeclineBookingModal
          booking={{
            id: data.bookingId,
            customerName,
            scheduledDate: data.bookingDate,
            scheduledTime: data.bookingTime || '',
          }}
          vendorId={vendorId}
          onClose={() => setShowDecline(false)}
          onSuccess={() => {
            setShowDecline(false);
            onDismiss();
          }}
        />
      )}
    </>
  );
}
