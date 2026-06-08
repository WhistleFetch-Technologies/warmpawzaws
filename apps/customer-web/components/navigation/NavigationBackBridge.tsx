'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { goBackOrReplace } from '@/lib/go-back-or-replace';
import {
  BACK_HANDLER_PRIORITY,
  registerBackHandler,
} from '@/lib/navigation/back-handler-registry';
import { getDeepLinkBackFallback } from '@/lib/navigation/deep-link-stack';
import { handleCapacitorAppUrlOpen, applyDeepLinkBackStackForCurrentPath } from '@/lib/navigation/deep-link-navigation';
import { initCapacitorHardwareBack, isCapacitorNativePlatform } from '@/lib/navigation/hardware-back';
import { initIosShellHistoryBridge } from '@/lib/navigation/ios-shell-history';

/**
 * Global navigation bridge: Capacitor hardware back + URL-layer back fallback.
 * Shell back is registered from CustomerHomeWrapper when mounted on `/`.
 */
export function NavigationBackBridge() {
  const router = useRouter();
  const pathname = usePathname() || '/';

  useEffect(() => {
    let removeUrlBack = () => {};
    let removeHardware = () => {};
    let removeIosHistory = () => {};
    let removeAppUrlOpen: (() => void) | null = null;

    const setup = async () => {
      removeHardware = await initCapacitorHardwareBack();
      removeIosHistory = initIosShellHistoryBridge();

      removeUrlBack = registerBackHandler(() => {
        const path = window.location.pathname || '/';
        if (path === '/' || path === '') return false;
        goBackOrReplace(router, getDeepLinkBackFallback(path));
        return true;
      }, BACK_HANDLER_PRIORITY.urlHistory);

      if (isCapacitorNativePlatform()) {
        try {
          const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
          const sub = await App.addListener('appUrlOpen', (event) => {
            if (event.url) handleCapacitorAppUrlOpen(event.url);
          });
          removeAppUrlOpen = () => {
            void sub.remove();
          };
        } catch (err) {
          console.warn('[navigation] appUrlOpen listener unavailable:', err);
        }
      }
    };

    void setup();

    return () => {
      removeUrlBack();
      removeHardware();
      removeIosHistory();
      removeAppUrlOpen?.();
    };
  }, [router]);

  useEffect(() => {
    applyDeepLinkBackStackForCurrentPath();
  }, [pathname]);

  return null;
}
