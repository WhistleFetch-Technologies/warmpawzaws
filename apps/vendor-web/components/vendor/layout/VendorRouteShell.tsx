'use client';

import type { ReactNode } from 'react';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { VendorPageShell, VendorMainColumn } from '@/components/vendor/layout/VendorResponsiveShell';
import { cn } from '@/components/ui/utils';

export interface VendorRouteShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  actions?: ReactNode[];
  headerTone?: 'default' | 'brand';
  shellClassName?: string;
  columnClassName?: string;
}

/**
 * Standard vendor route layout: page shell + main column + VendorHeader + scrollable body region.
 */
export function VendorRouteShell({
  title,
  subtitle,
  children,
  onBack,
  showBack = true,
  actions,
  headerTone = 'default',
  shellClassName,
  columnClassName,
}: VendorRouteShellProps) {
  return (
    <VendorPageShell className={cn('bg-gray-50 min-h-screen', shellClassName)}>
      <VendorMainColumn className={cn('flex min-h-screen flex-col bg-white', columnClassName)}>
        <VendorHeader
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          showBack={showBack}
          actions={actions}
          tone={headerTone}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </VendorMainColumn>
    </VendorPageShell>
  );
}
