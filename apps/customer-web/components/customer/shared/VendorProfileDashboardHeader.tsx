'use client';

import {
  ServiceDashboardHeader,
  type ServiceDashboardHeaderProps,
} from './ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';

export type VendorProfileDashboardHeaderProps = Omit<
  ServiceDashboardHeaderProps,
  'stats'
>;

const VENDOR_PROFILE_HEADER_GRADIENT =
  'bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]';

/**
 * Header for vendor profile screens — never shows rating/reviews/services/plan stat chips.
 * Use this instead of ServiceDashboardHeader on every vendor profile page.
 */
export function VendorProfileDashboardHeader({
  headerColor = VENDOR_PROFILE_HEADER_GRADIENT,
  ...props
}: VendorProfileDashboardHeaderProps) {
  return (
    <ServiceDashboardHeader
      {...props}
      headerColor={headerColor}
      stats={EMPTY_SERVICE_HEADER_STATS}
    />
  );
}
