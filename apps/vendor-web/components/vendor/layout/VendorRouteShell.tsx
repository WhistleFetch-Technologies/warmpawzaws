'use client';

import type { ReactNode } from 'react';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { VendorChromeLayout } from '@/components/vendor/layout/VendorChromeLayout';
import { VendorMainColumn } from '@/components/vendor/layout/VendorResponsiveShell';
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
 * Standard vendor route layout: full-viewport chrome + fixed VendorHeader + scrollable body.
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
    <VendorChromeLayout
      className={cn('bg-gray-50', shellClassName)}
      header={
        <div className="w-full bg-white shadow-sm">
          <VendorMainColumn className={cn('bg-white', columnClassName)}>
            <VendorHeader
              title={title}
              subtitle={subtitle}
              onBack={onBack}
              showBack={showBack}
              actions={actions}
              tone={headerTone}
              layoutWithinFixedParent
            />
          </VendorMainColumn>
        </div>
      }
      mainClassName="bg-gray-50"
    >
      <VendorMainColumn className={cn('min-h-full bg-white pb-4', columnClassName)}>
        {children}
      </VendorMainColumn>
    </VendorChromeLayout>
  );
}
