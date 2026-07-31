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
  petName?: string;
  petBreed?: string;
  addressLine?: string;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
};

export function WapptBookingSummaryStep({
  category,
  serviceStyle,
  amount,
  selectedDate,
  selectedTime,
  petName,
  petBreed,
  addressLine,
  onBack,
  onContinue,
  continueLabel = 'Proceed to Payment',
  loading,
}: WapptBookingSummaryStepProps) {
  const StyleIcon = serviceStyle === 'at_home' ? Home : Building2;
  const serviceLabel = getWarmpawzAppointmentServiceLabel({ category, serviceStyle });

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
            <p className="text-xs text-gray-500">Flat appointment fee</p>
          </div>
          <p className="font-bold text-orange-600">{formatPriceWithSymbol(amount)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>
            {selectedDate &&
              new Date(selectedDate).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}{' '}
            at {formatTime12Hour(selectedTime)}
          </span>
        </div>
        {petName ? (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400" />
            <span>
              {petName}
              {petBreed ? ` (${petBreed})` : ''}
            </span>
          </div>
        ) : null}
        {addressLine ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Home className="h-4 w-4 text-gray-400" />
            <span>{addressLine}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Subtotal</span>
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
