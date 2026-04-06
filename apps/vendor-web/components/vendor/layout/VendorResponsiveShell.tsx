'use client';

import { cn } from '@/components/ui/utils';

type ShellProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-viewport shell: prevents horizontal scroll, matches Login-era safe layout.
 */
export function VendorPageShell({ children, className }: ShellProps) {
  return <div className={cn('vendor-page-shell', className)}>{children}</div>;
}

/**
 * Primary content column — responsive width (430 → 2xl → 4xl → 6xl → 7xl).
 */
export function VendorMainColumn({ children, className }: ShellProps) {
  return <div className={cn('vendor-app-column', className)}>{children}</div>;
}

/**
 * Narrow column for phone/OTP Login-style screens (fixed 430px cap).
 */
export function VendorAuthColumn({ children, className }: ShellProps) {
  return <div className={cn('vendor-auth-column', className)}>{children}</div>;
}

/**
 * Inner wrapper for fixed bottom navigation — same max-width as VendorMainColumn.
 */
export function VendorBottomBarInner({ children, className }: ShellProps) {
  return <div className={cn('vendor-app-column-inner flex', className)}>{children}</div>;
}
