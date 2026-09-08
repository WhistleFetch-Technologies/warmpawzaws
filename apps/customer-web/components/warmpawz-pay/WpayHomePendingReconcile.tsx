'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { reconcileWpayPendingOnHome } from '@/lib/warmpawz-pay/wpay-home-pending-reconcile';
import { peekWpayPendingReturn } from '@/lib/warmpawz-pay/wpay-pending-return';

/**
 * After UPI the APK often resumes on `/`. History GET already completes
 * captured Pay Bills — run that here so nobody has to open Pay Bill again.
 */
export function WpayHomePendingReconcile({ phone }: { phone?: string }) {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (pathname !== '/') return;
    if (peekWpayPendingReturn()?.paymentId) return;

    const run = () => {
      void reconcileWpayPendingOnHome(phone).catch(() => undefined);
    };
    run();

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);

    let appListener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) run();
        });
      } catch {
        /* browser */
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      appListener?.remove().catch(() => undefined);
    };
  }, [pathname, phone]);

  return null;
}
