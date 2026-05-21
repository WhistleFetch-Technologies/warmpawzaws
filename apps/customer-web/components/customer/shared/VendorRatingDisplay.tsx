'use client';

import { StarRating } from './StarRating';
import {
  resolveVendorRatingForCard,
  vendorRatingRowFromEntity,
  type VendorRatingSource,
} from '@/lib/resolve-vendor-rating';

interface VendorRatingDisplayProps {
  row: VendorRatingSource;
  /** Preferred vendor account id when known (list card / profile). */
  vendorId?: string;
  className?: string;
  starsClassName?: string;
  textClassName?: string;
  showNumericRating?: boolean;
}

/** Renders StarRating only when the dedicated vendor has real reviews. */
export function VendorRatingDisplay({
  row,
  vendorId,
  className = '',
  starsClassName = 'h-4 w-4',
  textClassName = 'text-sm text-gray-600',
  showNumericRating = true,
}: VendorRatingDisplayProps) {
  const resolved = resolveVendorRatingForCard(
    vendorRatingRowFromEntity(row, vendorId),
    vendorId
  );
  if (!resolved.shouldShowRating || resolved.average == null) {
    return null;
  }
  return (
    <StarRating
      rating={resolved.average}
      reviewCount={resolved.reviewCount}
      className={className}
      starsClassName={starsClassName}
      textClassName={textClassName}
      showNumericRating={showNumericRating}
    />
  );
}
