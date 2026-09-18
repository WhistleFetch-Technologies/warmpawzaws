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

/** Catalogue % is no longer advertised on Pay Bill cards. */
export function formatWpayCatalogueDiscountLabel(_discountPercent: number): string | undefined {
  return undefined;
}

/** Pay Hub / WPay list discount pill — retired (Promotion Engine owns offers). */
export function buildWpayDiscountBadges(
  _discountPercent: number,
): WarmpawzPayVendorCardBadge[] | undefined {
  return undefined;
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
