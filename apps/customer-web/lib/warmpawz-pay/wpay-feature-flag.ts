import { isWarmpawzPayCommerceActive } from '@/lib/warmpawz-appointments-customer';
import type { CommerceConfigContextValue } from '@/lib/commerce-config-provider';
import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing/warmpawz-pay-feature';

function isWpayEnvAndRuntimeEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __WARMPAWZ_RUNTIME__?: { warmpawzPayEnabled?: boolean } })
      .__WARMPAWZ_RUNTIME__;
    if (runtime?.warmpawzPayEnabled === false) return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED !== 'false';
}

/** Warmpawz Pay customer UI gate — commerce switch + env flag. */
export function isWarmpawzPayEnabled(): boolean {
  if (!isWarmpawzPayCommerceActive()) return false;
  return isWpayEnvAndRuntimeEnabled();
}

/** React-context gate for Pay UI (bottom nav paw, walk-in surfaces). */
export function isWpayUiEnabled(commerce: CommerceConfigContextValue | null | undefined): boolean {
  if (!commerce?.isLoaded || !commerce.isWarmpawzPay) return false;
  if (!isWarmpawzPayModuleCapable()) return false;
  return isWpayEnvAndRuntimeEnabled();
}
