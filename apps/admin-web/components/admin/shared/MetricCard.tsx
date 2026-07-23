'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@warmpawz/ui';

export type MetricCardAvailability = 'available' | 'unavailable' | 'loading';

export interface MetricCardProps {
  readonly title: string;
  readonly subtitle: string;
  readonly icon: LucideIcon;
  /** Tailwind classes for the icon when the metric is available or loading. */
  readonly iconClassName?: string;
  /** Pre-formatted display value: counts, currency (₹1,500), percentages, etc. */
  readonly value?: string;
  readonly availability?: MetricCardAvailability;
  /** Shown when availability is `unavailable`. Defaults to "Coming Soon". */
  readonly unavailableLabel?: string;
  readonly valueClassName?: string;
  readonly className?: string;
}

const DEFAULT_UNAVAILABLE_LABEL = 'Coming Soon';

export function MetricCard({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'text-orange-500',
  value,
  availability = 'available',
  unavailableLabel = DEFAULT_UNAVAILABLE_LABEL,
  valueClassName = 'text-gray-900',
  className,
}: MetricCardProps) {
  const isUnavailable = availability === 'unavailable';
  const isLoading = availability === 'loading';

  const cardLabel = isUnavailable
    ? `${title}, ${unavailableLabel.toLowerCase()}`
    : isLoading
      ? `${title}, loading`
      : `${title}, ${value ?? 'unavailable'}`;

  return (
    <Card
      variant="outlined"
      className={
        isUnavailable
          ? `opacity-60 bg-gray-50${className ? ` ${className}` : ''}`
          : `bg-white${className ? ` ${className}` : ''}`
      }
      aria-label={cardLabel}
      aria-busy={isLoading || undefined}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{title}</span>
          <Icon
            className={`h-5 w-5 ${
              isUnavailable ? 'text-gray-400' : iconClassName
            }`}
            aria-hidden
          />
        </div>

        {isLoading ? (
          <div
            className="h-8 w-24 rounded bg-gray-200 animate-pulse"
            aria-hidden
          />
        ) : isUnavailable ? (
          <p className="text-lg font-semibold text-gray-500" aria-live="polite">
            {unavailableLabel}
          </p>
        ) : (
          <p
            className={`text-2xl font-semibold ${valueClassName}`}
            aria-live="polite"
          >
            {value}
          </p>
        )}

        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

/** Map backend `available: false` metrics to card availability. */
export function metricAvailabilityFromFlag(
  available: boolean | undefined,
): MetricCardAvailability {
  return available === false ? 'unavailable' : 'available';
}
