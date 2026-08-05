'use client';

import { Building2, Calendar, Home, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { formatTime12Hour } from '@/lib/wappt-booking-time';
import { getWarmpawzAppointmentServiceLabel } from '@/lib/warmpawz-appointments-customer';

type WapptBookingSummaryStepProps = {
  category: string;
  serviceStyle: string;
  amount: number;
  selectedDate: string;
  selectedTime: string;
  checkOutDate?: string;
  checkOutTime?: string;
  petName?: string;
  petBreed?: string;
  petSpecies?: string;
  addressLine?: string;
  variant?: 'default' | 'boarding';
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
};

function formatStayDate(date: string): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function WapptBookingSummaryStep({
  category,
  serviceStyle,
  amount,
  selectedDate,
  selectedTime,
  checkOutDate,
  checkOutTime,
  petName,
  petBreed,
  petSpecies,
  addressLine,
  variant = 'default',
  onBack,
  onContinue,
  continueLabel = 'Proceed to Payment',
  loading,
}: WapptBookingSummaryStepProps) {
  const StyleIcon = serviceStyle === 'at_home' ? Home : Building2;
  const serviceLabel = getWarmpawzAppointmentServiceLabel({ category, serviceStyle });
  const isBoarding = variant === 'boarding';

  return (
    <div className="space-y-4 cw-scroll-pad-tabbar">
      <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Booking Summary</h2>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <StyleIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{serviceLabel}</p>
            <p className="text-xs text-gray-500">Appointment fee</p>
          </div>
          <p className="font-bold text-orange-600">{formatPriceWithSymbol(amount)}</p>
        </div>

        {isBoarding ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-800">Check-in</p>
                <p className="text-gray-600">
                  {formatStayDate(selectedDate)} at {formatTime12Hour(selectedTime)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-800">Check-out</p>
                <p className="text-gray-600">
                  {formatStayDate(checkOutDate || selectedDate)} at{' '}
                  {formatTime12Hour(checkOutTime || selectedTime)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>
              {selectedDate && formatStayDate(selectedDate)} at {formatTime12Hour(selectedTime)}
            </span>
          </div>
        )}

        {petName ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <User className="h-4 w-4 text-orange-500" />
              Pet details
            </div>
            <p className="text-sm text-gray-700">{petName}</p>
            {petBreed || petSpecies ? (
              <p className="text-xs capitalize text-gray-500">
                {[petSpecies, petBreed].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {addressLine ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Home className="h-4 w-4 text-gray-400" />
            <span>{addressLine}</span>
          </div>
        ) : null}

        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Appointment fee</span>
          <span className="text-orange-600">{formatPriceWithSymbol(amount)}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          className="flex-1 bg-orange-500 hover:bg-orange-600"
          onClick={onContinue}
          disabled={loading}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
