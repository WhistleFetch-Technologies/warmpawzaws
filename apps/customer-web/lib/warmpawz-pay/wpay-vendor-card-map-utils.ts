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
  return { average: Math.round(numericRating * 10) / 10, reviewCount: count };
}

/** Listing pill before a bill is quoted. The rupee amount appears only after Get discount. */
export function formatWpayCatalogueDiscountLabel(discountPercent: number): string | undefined {
  if (!(discountPercent > 0)) return undefined;
  return 'Instant Savings';
}

/** Pay Hub pills: Instant Savings and Wallet Cashback, with no percent. */
export function buildWpayDiscountBadges(
  discountPercent: number,
  hasCashback = false,
): WarmpawzPayVendorCardBadge[] | undefined {
  const badges: WarmpawzPayVendorCardBadge[] = [];
  const savings = formatWpayCatalogueDiscountLabel(discountPercent);
  if (savings) badges.push({ label: savings, tone: 'discount' });
  if (hasCashback) badges.push({ label: 'Wallet Cashback', tone: 'success' });
  return badges.length ? badges : undefined;
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
