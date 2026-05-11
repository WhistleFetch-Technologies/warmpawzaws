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
}: {
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  weeklyPattern: SubscriptionDeliveryPattern;
  onWeeklyPatternChange: (p: SubscriptionDeliveryPattern) => void;
}) {
  if (purchaseType === 'MONTHLY_PLAN') {
    return (
      <div>
        <Label className="text-sm font-medium text-slate-800">Monthly plan</Label>
        <p className="text-xs text-slate-500 mt-1">
          Deliveries recur monthly on your chosen start date. Configure total sessions below (fixed pack) or rely on
          auto-renew for ongoing service.
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
