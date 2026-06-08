'use client';

import { useEffect } from 'react';
import {
  VENDOR_SHARE_LOG_PREFIX,
  vendorSharePathNeedsPlaceholderRedirect,
  buildVendorSharePlaceholderRedirectUrl,
} from '@/lib/vendor-profile-share';

/**
 * Static export only ships `/vendor/placeholder` (and persona placeholders).
 * Real UUID paths 404 → index.html (home). Redirect to the placeholder shell
 * with vendorId in query before React mounts the wrong page bundle.
 */
export function VendorSharePathBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const redirectUrl = buildVendorSharePlaceholderRedirectUrl(window.location.href);
    if (!redirectUrl) return;

    const current = `${window.location.pathname}${window.location.search}`;
    if (current === redirectUrl) return;

    if (vendorSharePathNeedsPlaceholderRedirect(window.location.href)) {
      console.log(VENDOR_SHARE_LOG_PREFIX, 'placeholder redirect', window.location.href, '->', redirectUrl);
      window.location.replace(redirectUrl);
    }
  }, []);

  return null;
}
