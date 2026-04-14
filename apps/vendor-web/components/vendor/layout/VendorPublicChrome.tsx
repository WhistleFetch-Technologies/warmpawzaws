'use client';

import type { ReactNode } from 'react';
import { VendorChromeLayout } from '@/components/vendor/layout/VendorChromeLayout';
const logoImage = '/logo.png';

export function VendorPublicHeader() {
  return (
    <header className="vendor-header-safe-x border-b border-orange-200/60 bg-[#FF8C42] shadow-sm safe-area-top">
      <div className="vendor-auth-column mx-auto flex min-h-[52px] items-center gap-3 px-4 py-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
          <img src={logoImage} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-white">Warmpawz</p>
          <p className="truncate text-xs text-white/90">Vendor Portal</p>
        </div>
      </div>
    </header>
  );
}

export function VendorPublicFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="vendor-header-safe-x border-t border-gray-200 bg-white safe-area-bottom">
      <div className="vendor-auth-column mx-auto px-4 py-2 text-center text-xs text-gray-500">
        {children ?? (
          <p className="leading-relaxed">
            Secure sign-in · Need help? Use in-app support after login.
          </p>
        )}
      </div>
    </footer>
  );
}

/**
 * Same chrome pattern as the main app: fixed top brand bar, fixed bottom strip, scrollable body.
 */
export function VendorPublicAppShell({ children }: { children: ReactNode }) {
  return (
    <VendorChromeLayout
      className="bg-gradient-to-br from-orange-50 to-amber-50"
      header={<VendorPublicHeader />}
      footer={<VendorPublicFooter />}
      mainClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-full w-full flex-1 flex-col">{children}</div>
    </VendorChromeLayout>
  );
}
