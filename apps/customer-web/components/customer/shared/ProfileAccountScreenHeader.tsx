'use client';

import { User, type LucideIcon } from 'lucide-react';
import { ServiceDashboardHeader } from './ServiceDashboardHeader';

export interface ProfileAccountScreenHeaderProps {
  /** Left: close profile flow and go to app home */
  onCloseToHome: () => void;
  /** Right: go to previous screen (optional — omit on root-only views) */
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  /** Optional icon tile; defaults to User */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Thin wrapper around ServiceDashboardHeader for account flows (X + Back, curved collar).
 */
export function ProfileAccountScreenHeader({
  onCloseToHome,
  onBack,
  title,
  subtitle,
  icon: Icon = User,
  className = '',
}: ProfileAccountScreenHeaderProps) {
  return (
    <div className={className}>
      <ServiceDashboardHeader
        serviceName={title?.trim() || 'Account'}
        serviceSubtitle={subtitle?.trim() || undefined}
        serviceIcon={Icon}
        iconColor="text-white"
        stats={[]}
        onCloseToHome={onCloseToHome}
        onBack={onBack}
        showBackButton={Boolean(onBack)}
      />
    </div>
  );
}
