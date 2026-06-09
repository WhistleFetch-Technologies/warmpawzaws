'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  VENDOR_SHARE_LOG_PREFIX,
  vendorShareUrlToAppPath,
  parseVendorShareUrl,
} from '@/lib/vendor-profile-share';

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform?.();
}

async function navigateFromExternalUrl(rawUrl: string, router: ReturnType<typeof useRouter>) {
  const appPath = vendorShareUrlToAppPath(rawUrl);
  if (!appPath) {
    console.warn(VENDOR_SHARE_LOG_PREFIX, 'ignored deep link — not a vendor share url', rawUrl);
    return;
  }

  const parsed = parseVendorShareUrl(rawUrl);
  console.log(VENDOR_SHARE_LOG_PREFIX, 'deep link received', {
    rawUrl,
    appPath,
    vendorId: parsed?.vendorId,
    persona: parsed?.persona,
    serviceStyle: parsed?.serviceStyle,
  });

  router.push(appPath);
}

export function CapacitorVendorDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let urlOpenListener: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');

        const launch = await App.getLaunchUrl();
        if (!cancelled && launch?.url) {
          await navigateFromExternalUrl(launch.url, router);
        }

        urlOpenListener = await App.addListener('appUrlOpen', (event) => {
          const url = event?.url;
          if (!url) return;
          void navigateFromExternalUrl(url, router);
        });
      } catch (err) {
        console.warn(VENDOR_SHARE_LOG_PREFIX, 'Capacitor App plugin unavailable', err);
      }
    })();

    return () => {
      cancelled = true;
      urlOpenListener?.remove().catch(() => undefined);
    };
  }, [router]);

  return null;
}
