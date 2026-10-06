import { CalendarCheck } from 'lucide-react';
import type { WarmpawzPayVendorCardProps } from '@/components/warmpawz-pay/vendor-card/types';
import type { VendorFeedbackPrompt } from './types';

/** "12 Oct 2026" — empty string when the date is missing or invalid. */
export function formatFeedbackServicedOn(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Pure: feedback prompt → compact vendor card (no actions, no profile chevron). */
export function mapFeedbackVendorToCardProps(prompt: VendorFeedbackPrompt): WarmpawzPayVendorCardProps {
  const { vendor } = prompt;
  const servicedOn = formatFeedbackServicedOn(prompt.transactionAt);

  return {
    variant: 'compact',
    name: vendor.name,
    imageUrl: vendor.photoUrl,
    categoryLabel: vendor.categoryLabel || undefined,
    showVerified: vendor.isVerified,
    verifiedAriaLabel: vendor.isVerified ? 'Verified provider' : undefined,
    distanceText: vendor.distanceText,
    address: vendor.address ?? undefined,
    metaItems: servicedOn
      ? [{ id: 'serviced-on', label: `Serviced on: ${servicedOn}`, icon: CalendarCheck, tone: 'success' }]
      : undefined,
    className: 'border-orange-100 shadow-none',
  };
}
