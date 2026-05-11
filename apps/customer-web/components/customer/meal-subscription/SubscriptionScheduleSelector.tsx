'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubscriptionDeliveryPattern } from './subscription-checkout-types';

export function SubscriptionScheduleSelector({
  purchaseType,
  weeklyPattern,
  onWeeklyPatternChange,
  monthlyVendorFrequencyLabel,
}: {
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  weeklyPattern: SubscriptionDeliveryPattern;
  onWeeklyPatternChange: (p: SubscriptionDeliveryPattern) => void;
  /** When set, subscription deliveries follow vendor-configured cadence (customer UI only). */
  monthlyVendorFrequencyLabel?: string | null;
}) {
  if (purchaseType === 'MONTHLY_PLAN') {
    return (
      <div>
        <Label className="text-sm font-medium text-slate-800">Monthly nutrition plan</Label>
        <p className="text-xs text-slate-500 mt-1">
          {monthlyVendorFrequencyLabel ? (
            <>
              Cadence matches how this vendor sells the plan:{' '}
              <span className="font-medium text-slate-700">{monthlyVendorFrequencyLabel}</span>. Total sessions is how
              many deliveries you pay for in this signup; auto-renew continues the same rhythm when enabled.
            </>
          ) : (
            <>
              Deliveries follow the cadence stored for this meal plan (legacy plans may use one drop per month). Configure
              total sessions below or use auto-renew for ongoing service.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-800">Weekly delivery rhythm</Label>
      <Select value={weeklyPattern} onValueChange={(v) => onWeeklyPatternChange(v as SubscriptionDeliveryPattern)}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Choose pattern" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="weekly_default">Once per week (same weekday as start date)</SelectItem>
          <SelectItem value="everyday">Every day</SelectItem>
          <SelectItem value="weekdays_only">Weekdays only (Mon–Fri)</SelectItem>
          <SelectItem value="alternate_days">Alternate days</SelectItem>
          <SelectItem value="specific_weekdays">Specific weekdays (pick below)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
