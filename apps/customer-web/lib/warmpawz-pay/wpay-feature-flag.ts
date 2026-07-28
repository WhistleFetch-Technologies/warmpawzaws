import { isWarmpawzPayCommerceActive } from '@/lib/warmpawz-appointments-customer';

/** Warmpawz Pay customer UI gate — commerce switch + env flag. */
export function isWarmpawzPayEnabled(): boolean {
  if (!isWarmpawzPayCommerceActive()) return false;
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __WARMPAWZ_RUNTIME__?: { warmpawzPayEnabled?: boolean } })
      .__WARMPAWZ_RUNTIME__;
    if (runtime?.warmpawzPayEnabled === false) return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED !== 'false';
}
