'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { VENDOR_FEATURE_FLAGS } from '@/lib/vendor-feature-flags';

const COMING_SOON_TOOLTIP = 'Feature will be available soon';

export interface EmergencyAvailabilitySosCardProps {
  className?: string;
}

/**
 * Emergency Availability (SOS) — bookings sidebar card.
 * When {@link VENDOR_FEATURE_FLAGS.emergencyAvailabilitySos} is false, shows a disabled control with a single “Coming Soon” label.
 */
export function EmergencyAvailabilitySosCard({ className }: EmergencyAvailabilitySosCardProps) {
  const isEmergencyEnabled = VENDOR_FEATURE_FLAGS.emergencyAvailabilitySos;

  return (
    <div className={cn(className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border p-4',
          isEmergencyEnabled
            ? 'border-red-200 bg-red-50'
            : 'border-neutral-200 bg-neutral-50/90 opacity-[0.88] saturate-[0.85]'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isEmergencyEnabled ? 'bg-red-500' : 'bg-neutral-400'
            )}
          >
            <span className="text-xl text-white" aria-hidden>
              🚨
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">Emergency Availability (SOS)</h3>
            <p className="text-xs text-gray-600">
              {isEmergencyEnabled ? '24x7 on-call service' : 'not available yet'}
            </p>
          </div>
        </div>

        {isEmergencyEnabled ? (
          <Button
            type="button"
            size="sm"
            className="shrink-0 rounded-lg bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600"
          >
            Enable
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled
            title={COMING_SOON_TOOLTIP}
            aria-disabled="true"
            className={cn(
              'shrink-0 cursor-not-allowed rounded-lg border border-neutral-300 bg-neutral-200 px-4 text-sm font-medium text-neutral-600',
              'opacity-90 hover:bg-neutral-200 hover:text-neutral-600'
            )}
          >
            Coming Soon
          </Button>
        )}
      </div>
    </div>
  );
}
