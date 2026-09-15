import type { MouseEvent } from 'react';
import type {
  WarmpawzPayVendorCardBadge,
  WarmpawzPayVendorCardProps,
} from '@/components/warmpawz-pay/vendor-card/types';

/** Normalized rating for WarmpawzPayVendorCard — hides row when no real reviews. */
export function resolveWpayVendorCardRating(
  rating: string | number,
  reviewCount: number,
): WarmpawzPayVendorCardProps['rating'] {
  const count = Number(reviewCount) || 0;
  const numericRating = Number(rating);
  if (count <= 0 || !Number.isFinite(numericRating) || numericRating <= 0) {
    return null;
  }
  return { average: numericRating, reviewCount: count };
}

/** Marketing copy for admin catalogue % — not the exact applied quote line. */
export function formatWpayCatalogueDiscountLabel(discountPercent: number): string | undefined {
  if (!(discountPercent > 0)) return undefined;
  return `Upto ${discountPercent}%`;
}

/** Pay Hub / WPay list discount pill — shared label format. */
export function buildWpayDiscountBadges(
  discountPercent: number,
): WarmpawzPayVendorCardBadge[] | undefined {
  const label = formatWpayCatalogueDiscountLabel(discountPercent);
  if (!label) return undefined;
  return [{ label, tone: 'discount' }];
}

/** Discovery-style dual CTA wiring — labels and handlers from parent. */
export function buildWpayVendorCardActions(opts: {
  primaryLabel: string;
  onPrimary: (event: MouseEvent<HTMLButtonElement>) => void;
  secondaryLabel?: string;
  onSecondary?: (event: MouseEvent<HTMLButtonElement>) => void;
}): Pick<WarmpawzPayVendorCardProps, 'primaryAction' | 'secondaryAction'> {
  const { primaryLabel, onPrimary, secondaryLabel, onSecondary } = opts;
  return {
    secondaryAction:
      onSecondary && secondaryLabel
        ? { label: secondaryLabel, variant: 'outline', onClick: onSecondary }
        : undefined,
    primaryAction: {
      label: primaryLabel,
      variant: 'default',
      onClick: onPrimary,
    },
  };
}

/** Omit empty optional address strings on card props. */
export function normalizeWpayVendorCardAddress(address: string): string | undefined {
  const trimmed = address.trim();
  return trimmed || undefined;
}
